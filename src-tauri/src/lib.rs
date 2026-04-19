use notify::{
    event::ModifyKind, Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher,
};
use serde::Serialize;
use std::{
    collections::HashMap,
    env, fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicU32, Ordering},
        mpsc, Mutex,
    },
    thread,
};
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct InitialSession {
    root_dir: String,
    files: Vec<String>,
    selected_file: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct HeadingItem {
    depth: u8,
    text: String,
    id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct MarkdownDocument {
    relative_path: String,
    content: String,
    headings: Vec<HeadingItem>,
}

#[derive(Debug, Clone)]
struct SessionState {
    root_dir: PathBuf,
    files: Vec<String>,
    selected_file: Option<String>,
}

struct AppState {
    sessions: Mutex<HashMap<String, SessionState>>,
    watchers: Mutex<HashMap<String, RecommendedWatcher>>,
    window_counter: AtomicU32,
}

enum ScanEntry {
    File(String),
    Skipped(String),
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FsChangePayload {
    changed_paths: Vec<String>,
    tree_changed: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
enum ScanStatus {
    Scanning,
    Completed,
    Error,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanProgressPayload {
    files: Vec<String>,
    selected_file: Option<String>,
    status: ScanStatus,
    skipped_paths: Vec<String>,
    error: Option<String>,
}

const FS_CHANGE_EVENT: &str = "markmini://fs-change";
const SCAN_PROGRESS_EVENT: &str = "markmini://scan-progress";
const SCAN_BATCH_SIZE: usize = 64;

// ---------------------------------------------------------------------------
// Tauri commands — all receive WebviewWindow to identify the calling window
// ---------------------------------------------------------------------------

#[tauri::command]
fn get_initial_session(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, AppState>,
) -> Result<InitialSession, String> {
    let sessions = state
        .sessions
        .lock()
        .map_err(|_| "failed to acquire sessions lock".to_string())?;

    let session = sessions
        .get(window.label())
        .ok_or_else(|| format!("no session for window {}", window.label()))?;

    Ok(InitialSession {
        root_dir: session.root_dir.to_string_lossy().to_string(),
        files: session.files.clone(),
        selected_file: session.selected_file.clone(),
    })
}

#[tauri::command]
fn refresh_session(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, AppState>,
) -> Result<InitialSession, String> {
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|_| "failed to acquire sessions lock".to_string())?;

    let session = sessions
        .get_mut(window.label())
        .ok_or_else(|| format!("no session for window {}", window.label()))?;

    let mut files = collect_markdown_files(&session.root_dir)?;
    files.sort();

    let selected_file = match &session.selected_file {
        Some(current) if files.iter().any(|entry| entry == current) => Some(current.clone()),
        _ => pick_default_document(&files),
    };

    session.files = files.clone();
    session.selected_file = selected_file.clone();

    Ok(InitialSession {
        root_dir: session.root_dir.to_string_lossy().to_string(),
        files,
        selected_file,
    })
}

#[tauri::command]
fn read_markdown_file(
    relative_path: String,
    window: tauri::WebviewWindow,
    state: tauri::State<'_, AppState>,
) -> Result<MarkdownDocument, String> {
    let sessions = state
        .sessions
        .lock()
        .map_err(|_| "failed to acquire sessions lock".to_string())?;

    let session = sessions
        .get(window.label())
        .ok_or_else(|| format!("no session for window {}", window.label()))?;

    if !session.files.iter().any(|entry| entry == &relative_path) {
        return Err(format!(
            "document is not available in the current root: {}",
            relative_path
        ));
    }

    let file_path = session.root_dir.join(&relative_path);
    let content = fs::read_to_string(&file_path).map_err(|error| {
        format!(
            "failed to read markdown file {}: {}",
            file_path.display(),
            error
        )
    })?;

    Ok(MarkdownDocument {
        relative_path,
        headings: extract_headings(&content),
        content,
    })
}

// ---------------------------------------------------------------------------
// Application entry point
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let current_dir = env::current_dir().expect("failed to resolve current directory");
    let raw_arg = env::args().nth(1);
    let target = resolve_target_from_args(raw_arg.as_deref(), &current_dir)
        .expect("failed to resolve launch target");

    // Determine root_dir and optional selected file hint without scanning.
    let (initial_root_dir, selected_hint) = split_target(target);

    // Start with an empty session — the window shows immediately.
    let initial_session = SessionState {
        root_dir: initial_root_dir.clone(),
        files: Vec::new(),
        selected_file: None,
    };

    let mut sessions = HashMap::new();
    sessions.insert("main".to_string(), initial_session);

    tauri::Builder::default()
        .manage(AppState {
            sessions: Mutex::new(sessions),
            watchers: Mutex::new(HashMap::new()),
            window_counter: AtomicU32::new(0),
        })
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            handle_new_instance(app, argv, cwd);
        }))
        .plugin(tauri_plugin_opener::init())
        .setup(move |app| {
            // Scan files in the background, then notify the frontend.
            let handle = app.handle().clone();
            let root = initial_root_dir.clone();
            let hint = selected_hint.clone();
            thread::spawn(move || {
                populate_session_async(&handle, "main", root, hint);
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                cleanup_window(window);
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_initial_session,
            refresh_session,
            read_markdown_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn split_target(target: PathBuf) -> (PathBuf, Option<PathBuf>) {
    if target.is_dir() {
        (target, None)
    } else {
        let parent = target
            .parent()
            .map(Path::to_path_buf)
            .unwrap_or_else(|| PathBuf::from("."));
        (parent, Some(target))
    }
}

/// Scans files in the background, updates the session, notifies the frontend,
/// and installs a file watcher. Runs on a dedicated thread.
fn populate_session_async(
    app_handle: &tauri::AppHandle,
    label: &str,
    root_dir: PathBuf,
    selected_hint: Option<PathBuf>,
) {
    let selected_hint_relative = selected_hint
        .as_ref()
        .and_then(|hint| path_to_relative(&root_dir, hint));

    let _ = app_handle.emit_to(
        label,
        SCAN_PROGRESS_EVENT,
        ScanProgressPayload {
            files: Vec::new(),
            selected_file: None,
            status: ScanStatus::Scanning,
            skipped_paths: Vec::new(),
            error: None,
        },
    );

    let mut files = Vec::<String>::new();
    let mut pending_files = Vec::<String>::new();
    let mut skipped_paths = Vec::<String>::new();
    let mut pending_skipped_paths = Vec::<String>::new();
    let mut selected_file = None::<String>;

    let flush_progress = |app_handle: &tauri::AppHandle,
                          files: &mut Vec<String>,
                          pending_files: &mut Vec<String>,
                          pending_skipped_paths: &mut Vec<String>,
                          selected_file: &mut Option<String>| {
        if pending_files.is_empty() && pending_skipped_paths.is_empty() {
            return;
        }

        pending_files.sort();
        pending_files.dedup();

        if selected_file.is_none() {
            if let Some(hint) = &selected_hint_relative {
                if pending_files.iter().any(|entry| entry == hint) {
                    *selected_file = Some(hint.clone());
                }
            }
        }

        {
            let state = app_handle.state::<AppState>();
            let mut sessions = state.sessions.lock().expect("sessions lock poisoned");
            if let Some(session) = sessions.get_mut(label) {
                merge_sorted_unique(&mut session.files, pending_files);
                session.selected_file = selected_file.clone();
            }
        }

        merge_sorted_unique(files, pending_files);

        let emitted_files = pending_files.clone();
        let emitted_skipped_paths = pending_skipped_paths.clone();
        pending_files.clear();
        pending_skipped_paths.clear();

        let _ = app_handle.emit_to(
            label,
            SCAN_PROGRESS_EVENT,
            ScanProgressPayload {
                files: emitted_files,
                selected_file: selected_file.clone(),
                status: ScanStatus::Scanning,
                skipped_paths: emitted_skipped_paths,
                error: None,
            },
        );
    };

    let scan_result = visit_dir_streaming(&root_dir, &root_dir, &mut |entry| {
        match entry {
            ScanEntry::File(relative) => pending_files.push(relative),
            ScanEntry::Skipped(skipped) => {
                skipped_paths.push(skipped.clone());
                pending_skipped_paths.push(skipped);
            }
        }

        if pending_files.len() >= SCAN_BATCH_SIZE || pending_skipped_paths.len() >= SCAN_BATCH_SIZE
        {
            flush_progress(
                app_handle,
                &mut files,
                &mut pending_files,
                &mut pending_skipped_paths,
                &mut selected_file,
            );
        }
    });

    flush_progress(
        app_handle,
        &mut files,
        &mut pending_files,
        &mut pending_skipped_paths,
        &mut selected_file,
    );

    let error = scan_result.err().map(|error| {
        eprintln!("failed to scan {}: {}", root_dir.display(), error);
        error
    });

    files.sort();
    files.dedup();

    if selected_file.is_none() {
        selected_file = match &selected_hint_relative {
            Some(hint) if files.iter().any(|entry| entry == hint) => Some(hint.clone()),
            _ => pick_default_document(&files),
        };
    }

    let final_status = if error.is_some() {
        ScanStatus::Error
    } else {
        ScanStatus::Completed
    };
    {
        let state = app_handle.state::<AppState>();
        let mut sessions = state.sessions.lock().expect("sessions lock poisoned");
        if let Some(session) = sessions.get_mut(label) {
            session.files = files.clone();
            session.selected_file = selected_file.clone();
        }
    }

    let _ = app_handle.emit_to(
        label,
        SCAN_PROGRESS_EVENT,
        ScanProgressPayload {
            files,
            selected_file,
            status: final_status,
            skipped_paths,
            error,
        },
    );

    // Install watcher after scan completes.
    if let Err(error) = install_file_watcher(app_handle, label, root_dir.clone()) {
        eprintln!(
            "failed to install file watcher for {} ({}): {}",
            label,
            root_dir.display(),
            error,
        );
    }
}

// ---------------------------------------------------------------------------
// Multi-window lifecycle
// ---------------------------------------------------------------------------

fn handle_new_instance(app: &tauri::AppHandle, argv: Vec<String>, cwd: String) {
    let raw_arg = argv.get(1).map(|s| s.as_str());
    let cwd_path = PathBuf::from(&cwd);

    let target = match resolve_target_from_args(raw_arg, &cwd_path) {
        Ok(target) => target,
        Err(error) => {
            eprintln!("failed to resolve new instance target: {}", error);
            focus_any_window(app);
            return;
        }
    };

    let (root_dir, selected_hint) = split_target(target);
    let state = app.state::<AppState>();
    let count = state.window_counter.fetch_add(1, Ordering::SeqCst) + 1;
    let label = format!("markmini-{}", count);

    let window_title = format!(
        "markmini — {}",
        root_dir
            .file_name()
            .unwrap_or(root_dir.as_os_str())
            .to_string_lossy()
    );

    // Register an empty session BEFORE creating the window.
    {
        let mut sessions = state.sessions.lock().expect("sessions lock poisoned");
        sessions.insert(
            label.clone(),
            SessionState {
                root_dir: root_dir.clone(),
                files: Vec::new(),
                selected_file: None,
            },
        );
    }

    let builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::App("index.html".into()))
        .title(&window_title)
        .inner_size(1440.0, 920.0)
        .min_inner_size(1080.0, 720.0);

    match builder.build() {
        Ok(_) => {
            let handle = app.clone();
            let lbl = label.clone();
            thread::spawn(move || {
                populate_session_async(&handle, &lbl, root_dir, selected_hint);
            });
        }
        Err(error) => {
            eprintln!("failed to create window {}: {}", label, error);
            let mut sessions = state.sessions.lock().expect("sessions lock poisoned");
            sessions.remove(&label);
            focus_any_window(app);
        }
    }
}

fn focus_any_window(app: &tauri::AppHandle) {
    if let Some(window) = app.webview_windows().values().next() {
        let _ = window.set_focus();
    }
}

fn cleanup_window(window: &tauri::Window) {
    let label = window.label();
    let app = window.app_handle();
    let state = app.state::<AppState>();

    if let Ok(mut watchers) = state.watchers.lock() {
        watchers.remove(label);
    };
    if let Ok(mut sessions) = state.sessions.lock() {
        sessions.remove(label);
    };
}

// ---------------------------------------------------------------------------
// Per-window file watcher
// ---------------------------------------------------------------------------

fn install_file_watcher(
    app_handle: &tauri::AppHandle,
    window_label: &str,
    root_dir: PathBuf,
) -> Result<(), String> {
    let handle = app_handle.clone();
    let label = window_label.to_string();

    let (tx, rx) = mpsc::channel::<notify::Result<Event>>();
    let mut watcher = RecommendedWatcher::new(
        move |res| {
            let _ = tx.send(res);
        },
        Config::default(),
    )
    .map_err(|error| format!("failed to create watcher: {}", error))?;

    watcher
        .watch(&root_dir, RecursiveMode::Recursive)
        .map_err(|error| format!("failed to watch {}: {}", root_dir.display(), error))?;

    {
        let state = handle.state::<AppState>();
        let mut watchers = state
            .watchers
            .lock()
            .map_err(|_| "watchers lock poisoned".to_string())?;
        watchers.insert(label.clone(), watcher);
    }

    let watch_root = root_dir;
    let emit_label = label;
    thread::spawn(move || {
        while let Ok(result) = rx.recv() {
            match result {
                Ok(event) => {
                    if let Some(payload) = classify_event(&event, &watch_root) {
                        let _ = handle.emit_to(&emit_label, FS_CHANGE_EVENT, payload);
                    }
                }
                Err(error) => {
                    eprintln!("file watcher error ({}): {}", emit_label, error);
                }
            }
        }
    });

    Ok(())
}

fn classify_event(event: &Event, root_dir: &Path) -> Option<FsChangePayload> {
    let kind_is_tree = matches!(
        event.kind,
        EventKind::Create(_) | EventKind::Remove(_) | EventKind::Modify(ModifyKind::Name(_))
    );
    let kind_is_modify = matches!(event.kind, EventKind::Modify(_));

    if !kind_is_tree && !kind_is_modify {
        return None;
    }

    let mut changed_paths = Vec::new();
    let mut tree_changed = false;

    for path in &event.paths {
        if is_inside_skipped_dir(path, root_dir) {
            continue;
        }

        if !is_markdown_file(path) {
            continue;
        }

        if kind_is_tree {
            tree_changed = true;
        }

        if let Some(relative) = path_to_relative(root_dir, path) {
            if !changed_paths.iter().any(|existing| existing == &relative) {
                changed_paths.push(relative);
            }
        }
    }

    if !tree_changed && changed_paths.is_empty() {
        return None;
    }

    Some(FsChangePayload {
        changed_paths,
        tree_changed,
    })
}

fn is_inside_skipped_dir(path: &Path, root_dir: &Path) -> bool {
    let relative = match path.strip_prefix(root_dir) {
        Ok(value) => value,
        Err(_) => return false,
    };

    for component in relative.components() {
        if let std::path::Component::Normal(name) = component {
            if let Some(name) = name.to_str() {
                if matches!(name, ".git" | "node_modules" | "target" | "dist" | ".next") {
                    return true;
                }
            }
        }
    }

    false
}

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

fn resolve_target_from_args(raw_arg: Option<&str>, cwd: &Path) -> Result<PathBuf, String> {
    let canonical = match raw_arg {
        Some(value) if !value.is_empty() => resolve_arg_path(value, cwd)?,
        _ => {
            let dir = sensible_default_dir(cwd);
            dir.canonicalize().map_err(|error| {
                format!("failed to resolve directory {}: {}", dir.display(), error)
            })?
        }
    };

    if canonical.is_dir() || is_markdown_file(&canonical) {
        Ok(canonical)
    } else {
        Err(format!(
            "launch target must be a directory or markdown file: {}",
            canonical.display()
        ))
    }
}

/// Finder/.app 실행 시 cwd가 `/`인 경우 사용자 홈 디렉터리로 대체합니다.
fn sensible_default_dir(cwd: &Path) -> PathBuf {
    if cwd.parent().is_some() && cwd != Path::new("/") {
        return cwd.to_path_buf();
    }

    if let Some(home) = env::var_os("HOME") {
        let home_path = PathBuf::from(home);
        if home_path.is_dir() {
            return home_path;
        }
    }

    cwd.to_path_buf()
}

fn resolve_arg_path(raw_arg: &str, current_dir: &Path) -> Result<PathBuf, String> {
    let path = PathBuf::from(raw_arg);
    if path.is_absolute() {
        return path.canonicalize().map_err(|error| {
            format!(
                "failed to resolve launch target {}: {}",
                path.display(),
                error
            )
        });
    }

    let mut base_dirs: Vec<PathBuf> = Vec::new();

    if let Ok(pwd) = env::var("PWD") {
        let pwd_path = PathBuf::from(pwd);
        if pwd_path.is_dir() {
            base_dirs.push(pwd_path);
        }
    }

    base_dirs.push(current_dir.to_path_buf());

    if let Some(parent) = current_dir.parent() {
        base_dirs.push(parent.to_path_buf());
    }

    let manifest_parent = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(Path::to_path_buf);
    if let Some(parent) = &manifest_parent {
        base_dirs.push(parent.clone());
    }

    for base_dir in dedupe_paths(base_dirs) {
        let candidate = base_dir.join(&path);
        if let Ok(canonical) = candidate.canonicalize() {
            return Ok(canonical);
        }
    }

    Err(format!(
        "failed to resolve launch target {} from bases: {}",
        raw_arg,
        dedupe_paths(vec![
            PathBuf::from(env::var("PWD").unwrap_or_default()),
            current_dir.to_path_buf(),
            current_dir
                .parent()
                .map(Path::to_path_buf)
                .unwrap_or_default(),
            manifest_parent.clone().unwrap_or_default(),
        ])
        .into_iter()
        .filter(|path| !path.as_os_str().is_empty())
        .map(|path| path.display().to_string())
        .collect::<Vec<_>>()
        .join(", ")
    ))
}

fn dedupe_paths(paths: Vec<PathBuf>) -> Vec<PathBuf> {
    let mut unique = Vec::<PathBuf>::new();

    for path in paths {
        if path.as_os_str().is_empty() {
            continue;
        }

        if unique.iter().any(|existing| existing == &path) {
            continue;
        }

        unique.push(path);
    }

    unique
}

// ---------------------------------------------------------------------------
// File scanning
// ---------------------------------------------------------------------------

fn collect_markdown_files(root_dir: &Path) -> Result<Vec<String>, String> {
    let mut files = Vec::new();
    visit_dir(root_dir, root_dir, &mut files)?;
    Ok(files)
}

fn visit_dir(root_dir: &Path, directory: &Path, files: &mut Vec<String>) -> Result<(), String> {
    let entries = match fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(_) => return Ok(()), // permission denied 등 — 건너뛰고 계속
    };

    for entry_result in entries {
        let entry = match entry_result {
            Ok(entry) => entry,
            Err(_) => continue,
        };
        let path = entry.path();

        if path.is_dir() {
            if should_skip_dir(&path) {
                continue;
            }

            visit_dir(root_dir, &path, files)?;
            continue;
        }

        if is_markdown_file(&path) {
            if let Some(relative) = path_to_relative(root_dir, &path) {
                files.push(relative);
            }
        }
    }

    Ok(())
}

fn visit_dir_streaming(
    root_dir: &Path,
    directory: &Path,
    on_entry: &mut impl FnMut(ScanEntry),
) -> Result<(), String> {
    let entries = match fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(_) => {
            if let Some(relative) = path_to_relative(root_dir, directory) {
                on_entry(ScanEntry::Skipped(relative));
            }
            return Ok(());
        }
    };

    for entry_result in entries {
        let entry = match entry_result {
            Ok(entry) => entry,
            Err(_) => continue,
        };
        let path = entry.path();

        if path.is_dir() {
            if should_skip_dir(&path) {
                if let Some(relative) = path_to_relative(root_dir, &path) {
                    on_entry(ScanEntry::Skipped(relative));
                }
                continue;
            }

            visit_dir_streaming(root_dir, &path, on_entry)?;
            continue;
        }

        if is_markdown_file(&path) {
            if let Some(relative) = path_to_relative(root_dir, &path) {
                on_entry(ScanEntry::File(relative));
            }
        }
    }

    Ok(())
}

fn merge_sorted_unique(target: &mut Vec<String>, incoming: &[String]) {
    for path in incoming {
        if !target.iter().any(|existing| existing == path) {
            target.push(path.clone());
        }
    }
    target.sort();
    target.dedup();
}

fn should_skip_dir(path: &Path) -> bool {
    let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
        return false;
    };

    matches!(name, ".git" | "node_modules" | "target" | "dist" | ".next")
}

fn is_markdown_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| matches!(ext.to_ascii_lowercase().as_str(), "md" | "markdown"))
        .unwrap_or(false)
}

fn path_to_relative(root_dir: &Path, path: &Path) -> Option<String> {
    path.strip_prefix(root_dir).ok().map(|relative| {
        relative
            .to_string_lossy()
            .replace('\\', "/")
            .trim_start_matches("./")
            .to_string()
    })
}

fn pick_default_document(files: &[String]) -> Option<String> {
    let preferred = ["README.md", "readme.md", "index.md"];

    for candidate in preferred {
        if let Some(found) = files.iter().find(|entry| entry.ends_with(candidate)) {
            return Some(found.clone());
        }
    }

    files.first().cloned()
}

// ---------------------------------------------------------------------------
// Markdown helpers
// ---------------------------------------------------------------------------

fn extract_headings(markdown: &str) -> Vec<HeadingItem> {
    let mut counts = std::collections::HashMap::<String, usize>::new();
    let mut headings = Vec::new();

    for line in markdown.lines() {
        let trimmed = line.trim();
        let hash_count = trimmed.chars().take_while(|ch| *ch == '#').count();

        if !(1..=3).contains(&hash_count) {
            continue;
        }

        let remainder = trimmed[hash_count..].trim();
        if remainder.is_empty() {
            continue;
        }

        let text = strip_markdown_inline(remainder);
        if text.is_empty() {
            continue;
        }

        let slug_base = slugify(&text);
        let entry = counts.entry(slug_base.clone()).or_insert(0);
        let id = if *entry == 0 {
            slug_base
        } else {
            format!("{}-{}", slug_base, *entry)
        };
        *entry += 1;

        headings.push(HeadingItem {
            depth: hash_count as u8,
            text,
            id,
        });
    }

    headings
}

fn strip_markdown_inline(value: &str) -> String {
    value
        .replace("**", "")
        .replace('*', "")
        .replace('_', "")
        .replace('`', "")
        .trim()
        .to_string()
}

fn slugify(value: &str) -> String {
    let mut slug = String::new();
    let mut previous_dash = false;

    for character in value.to_lowercase().chars() {
        if character.is_alphanumeric() || ('가'..='힣').contains(&character) {
            slug.push(character);
            previous_dash = false;
        } else if !previous_dash {
            slug.push('-');
            previous_dash = true;
        }
    }

    slug.trim_matches('-').to_string()
}

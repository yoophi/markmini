use notify::{
    event::ModifyKind, Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher,
};
use serde::Serialize;
use std::{
    env,
    fs,
    path::{Path, PathBuf},
    sync::{mpsc, Mutex},
    thread,
};
use tauri::{Emitter, Manager};

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
    session: Mutex<SessionState>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FsChangePayload {
    changed_paths: Vec<String>,
    tree_changed: bool,
}

struct WatcherGuard {
    _watcher: Mutex<RecommendedWatcher>,
}

const FS_CHANGE_EVENT: &str = "markmini://fs-change";

#[tauri::command]
fn get_initial_session(state: tauri::State<'_, AppState>) -> Result<InitialSession, String> {
    let session = state
        .session
        .lock()
        .map_err(|_| "failed to acquire session lock".to_string())?;

    Ok(InitialSession {
        root_dir: session.root_dir.to_string_lossy().to_string(),
        files: session.files.clone(),
        selected_file: session.selected_file.clone(),
    })
}

#[tauri::command]
fn refresh_session(state: tauri::State<'_, AppState>) -> Result<InitialSession, String> {
    let mut session = state
        .session
        .lock()
        .map_err(|_| "failed to acquire session lock".to_string())?;

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
fn read_markdown_file(relative_path: String, state: tauri::State<'_, AppState>) -> Result<MarkdownDocument, String> {
    let session = state
        .session
        .lock()
        .map_err(|_| "failed to acquire session lock".to_string())?;

    if !session.files.iter().any(|entry| entry == &relative_path) {
        return Err(format!("document is not available in the current root: {}", relative_path));
    }

    let file_path = session.root_dir.join(&relative_path);
    let content = fs::read_to_string(&file_path)
        .map_err(|error| format!("failed to read markdown file {}: {}", file_path.display(), error))?;

    Ok(MarkdownDocument {
        relative_path,
        headings: extract_headings(&content),
        content,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let session = resolve_session_state().expect("failed to resolve launch target");
    let root_dir = session.root_dir.clone();

    tauri::Builder::default()
        .manage(AppState {
            session: Mutex::new(session),
        })
        .plugin(tauri_plugin_opener::init())
        .setup(move |app| {
            if let Err(error) = install_file_watcher(app, root_dir.clone()) {
                eprintln!("failed to install file watcher for {}: {}", root_dir.display(), error);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_initial_session,
            refresh_session,
            read_markdown_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn install_file_watcher(app: &mut tauri::App, root_dir: PathBuf) -> Result<(), String> {
    let app_handle = app.handle().clone();

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

    app.manage(WatcherGuard {
        _watcher: Mutex::new(watcher),
    });

    let watch_root = root_dir.clone();
    thread::spawn(move || {
        while let Ok(result) = rx.recv() {
            match result {
                Ok(event) => {
                    if let Some(payload) = classify_event(&event, &watch_root) {
                        let _ = app_handle.emit(FS_CHANGE_EVENT, payload);
                    }
                }
                Err(error) => {
                    eprintln!("file watcher error: {}", error);
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

fn resolve_session_state() -> Result<SessionState, String> {
    let target = resolve_launch_target()?;
    let (root_dir, selected_candidate) = if target.is_dir() {
        (target, None)
    } else {
        let parent = target
            .parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| format!("failed to resolve parent directory for {}", target.display()))?;
        (parent, Some(target))
    };

    let mut files = collect_markdown_files(&root_dir)?;
    files.sort();

    let selected_file = if let Some(file_path) = selected_candidate {
        path_to_relative(&root_dir, &file_path)
    } else {
        pick_default_document(&files)
    };

    Ok(SessionState {
        root_dir,
        files,
        selected_file,
    })
}

fn resolve_launch_target() -> Result<PathBuf, String> {
    let raw_arg = env::args().nth(1);
    let current_dir = env::current_dir().map_err(|error| format!("failed to resolve current directory: {}", error))?;

    let canonical = match raw_arg {
        Some(value) => resolve_arg_path(&value, &current_dir)?,
        None => current_dir
            .canonicalize()
            .map_err(|error| format!("failed to resolve current directory {}: {}", current_dir.display(), error))?,
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

fn resolve_arg_path(raw_arg: &str, current_dir: &Path) -> Result<PathBuf, String> {
    let path = PathBuf::from(raw_arg);
    if path.is_absolute() {
        return path
            .canonicalize()
            .map_err(|error| format!("failed to resolve launch target {}: {}", path.display(), error));
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
            current_dir.parent().map(Path::to_path_buf).unwrap_or_default(),
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

fn collect_markdown_files(root_dir: &Path) -> Result<Vec<String>, String> {
    let mut files = Vec::new();
    visit_dir(root_dir, root_dir, &mut files)?;
    Ok(files)
}

fn visit_dir(root_dir: &Path, directory: &Path, files: &mut Vec<String>) -> Result<(), String> {
    let entries = fs::read_dir(directory)
        .map_err(|error| format!("failed to read directory {}: {}", directory.display(), error))?;

    for entry_result in entries {
        let entry = entry_result.map_err(|error| format!("failed to inspect directory entry: {}", error))?;
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

use std::{
    env,
    path::{Path, PathBuf},
    process::{Command, Stdio},
};

fn main() {
    match run() {
        Ok(()) => {}
        Err(error) => {
            eprintln!("mm: {}", error);
            std::process::exit(1);
        }
    }
}

fn run() -> Result<(), String> {
    let raw_target = env::args().nth(1).unwrap_or_else(|| ".".to_string());
    let cwd = env::current_dir().map_err(|error| format!("failed to read cwd: {}", error))?;
    let target = resolve_target(&raw_target, &cwd)?;
    let app = find_markmini_app()?;

    Command::new(&app)
        .arg(&target)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("failed to launch {}: {}", app.display(), error))?;

    Ok(())
}

fn resolve_target(raw_target: &str, cwd: &Path) -> Result<PathBuf, String> {
    let path = PathBuf::from(raw_target);
    let candidate = if path.is_absolute() {
        path
    } else {
        cwd.join(path)
    };

    let canonical = candidate
        .canonicalize()
        .map_err(|error| format!("failed to resolve {}: {}", candidate.display(), error))?;

    if canonical.is_dir() || is_markdown_file(&canonical) {
        Ok(canonical)
    } else {
        Err(format!(
            "target must be a directory or markdown file: {}",
            canonical.display()
        ))
    }
}

fn find_markmini_app() -> Result<PathBuf, String> {
    if let Some(path) = env::var_os("MARKMINI_APP_PATH").map(PathBuf::from) {
        if path.is_file() {
            return Ok(path);
        }
        return Err(format!(
            "MARKMINI_APP_PATH does not point to an executable file: {}",
            path.display()
        ));
    }

    let current_exe =
        env::current_exe().map_err(|error| format!("failed to locate mm executable: {}", error))?;
    let exe_dir = current_exe
        .parent()
        .ok_or_else(|| "failed to locate mm executable directory".to_string())?;

    for candidate in sibling_app_candidates(exe_dir) {
        if candidate.is_file() {
            return Ok(candidate);
        }
    }

    for candidate in installed_app_candidates() {
        if candidate.is_file() {
            return Ok(candidate);
        }
    }

    Err(
        "failed to locate markmini app. Set MARKMINI_APP_PATH to the markmini executable"
            .to_string(),
    )
}

fn sibling_app_candidates(exe_dir: &Path) -> Vec<PathBuf> {
    let mut candidates = vec![exe_dir.join(app_executable_name())];

    #[cfg(target_os = "macos")]
    {
        candidates.push(exe_dir.join("../MacOS/markmini"));
    }

    candidates
}

fn installed_app_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    #[cfg(target_os = "macos")]
    {
        candidates.push(PathBuf::from(
            "/Applications/markmini.app/Contents/MacOS/markmini",
        ));
        candidates.push(PathBuf::from(
            "/Applications/Markmini.app/Contents/MacOS/markmini",
        ));
    }

    candidates
}

fn app_executable_name() -> &'static str {
    #[cfg(target_os = "windows")]
    {
        "markmini.exe"
    }

    #[cfg(not(target_os = "windows"))]
    {
        "markmini"
    }
}

fn is_markdown_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| matches!(ext.to_ascii_lowercase().as_str(), "md" | "markdown"))
        .unwrap_or(false)
}

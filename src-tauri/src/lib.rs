//! ShutterProof application shell.
//!
//! Stage 1 exposes a single, read-only command so the React frontend can prove
//! the IPC bridge is wired. There is deliberately no persistence, file import,
//! networking, or model access in this slice; those arrive in later stages
//! behind explicit commands.

use serde::Serialize;

/// Non-sensitive build information surfaced in the shell footer.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub stage: String,
}

impl AppInfo {
    fn current() -> Self {
        Self {
            name: "ShutterProof".to_string(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            stage: "stage-1-shell".to_string(),
        }
    }
}

/// Returns static build metadata. No user data is read or returned.
#[tauri::command]
fn app_info() -> AppInfo {
    AppInfo::current()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![app_info])
        .run(tauri::generate_context!())
        .expect("failed to start the ShutterProof shell");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_info_reports_package_version() {
        let info = AppInfo::current();
        assert_eq!(info.name, "ShutterProof");
        assert_eq!(info.version, env!("CARGO_PKG_VERSION"));
    }
}

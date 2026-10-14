//! ShutterProof application shell.
//!
//! Stage 2 adds a local SQLite-backed records store. The frontend never touches
//! the database or filesystem directly: every action goes through a validated
//! Tauri command in `commands`.

mod backup;
mod commands;
mod db;
mod error;
mod files;
mod models;
mod state;
mod validate;

use std::sync::Arc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let state = state::AppState::init(app.handle())?;
            app.manage(Arc::new(state));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_info,
            commands::list_gear,
            commands::get_gear,
            commands::create_gear,
            commands::update_gear,
            commands::delete_gear,
            commands::list_evidence,
            commands::import_evidence,
            commands::delete_evidence,
            commands::list_timeline,
            commands::create_timeline_event,
            commands::delete_timeline_event,
            commands::records_status,
            commands::backup_records,
            commands::restore_records,
        ])
        .run(tauri::generate_context!())
        .expect("failed to start the ShutterProof shell");
}

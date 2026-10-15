//! Tauri commands. Every database or filesystem action the UI can trigger is
//! one of these explicit, validated entry points.

use std::path::Path;
use std::sync::Arc;

use tauri::State;

use crate::error::{AppError, AppResult};
use crate::models::{
    AppInfo, BackupInfo, DataStatus, Evidence, Extraction, Gear, GearInput, OllamaStatus,
    TimelineEvent, TimelineEventInput,
};
use crate::state::AppState;
use crate::{backup, db, document, extract, files, ollama, validate};

type Shared = Arc<AppState>;

/// Runs a blocking task off the UI thread with the shared state.
async fn run<T, F>(state: &State<'_, Shared>, task: F) -> AppResult<T>
where
    T: Send + 'static,
    F: FnOnce(&AppState) -> AppResult<T> + Send + 'static,
{
    let shared = Arc::clone(state.inner());
    tauri::async_runtime::spawn_blocking(move || task(&shared))
        .await
        .map_err(|error| AppError::internal(error.to_string()))?
}

fn lock_error() -> AppError {
    AppError::internal("The records database is busy.")
}

fn timestamp() -> String {
    chrono::Utc::now().to_rfc3339()
}

#[tauri::command]
pub fn app_info() -> AppInfo {
    AppInfo {
        name: "ShutterProof".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        stage: "stage-3-extraction".to_string(),
    }
}

#[tauri::command]
pub async fn list_gear(state: State<'_, Shared>) -> AppResult<Vec<Gear>> {
    run(&state, |shared| shared.with_conn(db::list_gear)).await
}

#[tauri::command]
pub async fn get_gear(state: State<'_, Shared>, id: String) -> AppResult<Gear> {
    run(&state, move |shared| {
        shared.with_conn(|conn| db::get_gear(conn, &id))
    })
    .await
}

#[tauri::command]
pub async fn create_gear(state: State<'_, Shared>, input: GearInput) -> AppResult<Gear> {
    run(&state, move |shared| {
        shared.with_conn(|conn| db::insert_gear(conn, input))
    })
    .await
}

#[tauri::command]
pub async fn update_gear(
    state: State<'_, Shared>,
    id: String,
    input: GearInput,
) -> AppResult<Gear> {
    run(&state, move |shared| {
        shared.with_conn(|conn| db::update_gear(conn, &id, input))
    })
    .await
}

#[tauri::command]
pub async fn delete_gear(state: State<'_, Shared>, id: String) -> AppResult<()> {
    run(&state, move |shared| {
        let stored = shared.with_conn(|conn| db::delete_gear(conn, &id))?;
        for name in stored {
            files::remove_stored(&shared.evidence_dir, &name)?;
        }
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn list_evidence(state: State<'_, Shared>, gear_id: String) -> AppResult<Vec<Evidence>> {
    run(&state, move |shared| {
        shared.with_conn(|conn| db::list_evidence(conn, &gear_id))
    })
    .await
}

#[tauri::command]
pub async fn import_evidence(
    state: State<'_, Shared>,
    gear_id: String,
    source_path: String,
    kind: String,
) -> AppResult<Evidence> {
    run(&state, move |shared| {
        validate::evidence_kind(&kind)?;
        shared.with_conn(|conn| db::get_gear(conn, &gear_id))?;

        let original_name = Path::new(&source_path)
            .file_name()
            .and_then(|name| name.to_str())
            .map(|name| name.to_string())
            .filter(|name| !name.is_empty())
            .ok_or_else(|| AppError::validation("That file could not be read."))?;

        let stem = uuid::Uuid::new_v4().to_string();
        let imported = files::import_source(
            Path::new(&source_path),
            &shared.temp_dir,
            &shared.evidence_dir,
            &stem,
        )?;

        let evidence = Evidence {
            id: uuid::Uuid::new_v4().to_string(),
            gear_id: gear_id.clone(),
            kind,
            original_name,
            stored_name: format!("{stem}.{}", imported.extension),
            mime_type: imported.mime_type,
            byte_size: imported.byte_size,
            sha256: imported.sha256,
            created_at: timestamp(),
        };

        if let Err(error) = shared.with_conn(|conn| db::insert_evidence(conn, &evidence)) {
            let _ = files::remove_stored(&shared.evidence_dir, &evidence.stored_name);
            return Err(error);
        }
        Ok(evidence)
    })
    .await
}

#[tauri::command]
pub async fn delete_evidence(state: State<'_, Shared>, id: String) -> AppResult<()> {
    run(&state, move |shared| {
        let stored = shared.with_conn(|conn| db::delete_evidence(conn, &id))?;
        files::remove_stored(&shared.evidence_dir, &stored)
    })
    .await
}

#[tauri::command]
pub async fn list_timeline(
    state: State<'_, Shared>,
    gear_id: String,
) -> AppResult<Vec<TimelineEvent>> {
    run(&state, move |shared| {
        shared.with_conn(|conn| db::list_timeline(conn, &gear_id))
    })
    .await
}

#[tauri::command]
pub async fn create_timeline_event(
    state: State<'_, Shared>,
    gear_id: String,
    input: TimelineEventInput,
) -> AppResult<TimelineEvent> {
    run(&state, move |shared| {
        shared.with_conn(|conn| db::insert_timeline(conn, &gear_id, &input))
    })
    .await
}

#[tauri::command]
pub async fn delete_timeline_event(state: State<'_, Shared>, id: String) -> AppResult<()> {
    run(&state, move |shared| {
        shared.with_conn(|conn| db::delete_timeline(conn, &id))
    })
    .await
}

#[tauri::command]
pub async fn records_status(state: State<'_, Shared>) -> AppResult<DataStatus> {
    run(&state, |shared| {
        let (gear_count, evidence_count) = shared.with_conn(db::counts)?;
        Ok(DataStatus {
            data_dir: shared.data_dir.to_string_lossy().to_string(),
            default_backup_dir: shared.default_backup_dir.to_string_lossy().to_string(),
            gear_count,
            evidence_count,
        })
    })
    .await
}

#[tauri::command]
pub async fn backup_records(state: State<'_, Shared>, dest_dir: String) -> AppResult<BackupInfo> {
    run(&state, move |shared| {
        let counts = shared.with_conn(|conn| {
            let _ = conn.query_row("PRAGMA wal_checkpoint(TRUNCATE)", [], |_row| Ok(()));
            db::counts(conn)
        })?;
        backup::create_backup(
            &shared.db_path,
            &shared.evidence_dir,
            Path::new(&dest_dir),
            counts,
            env!("CARGO_PKG_VERSION"),
        )
    })
    .await
}

/// Whether the local model is reachable and the chosen model is installed.
/// Never an error: the UI needs the guidance whether or not Ollama is running.
#[tauri::command]
pub async fn ollama_status() -> OllamaStatus {
    ollama::status().await
}

/// Reads a receipt with the local model and returns suggestions to review.
/// Nothing is written to the database: the photographer accepts or corrects
/// each value in the editor afterwards.
#[tauri::command]
pub async fn extract_receipt(
    source_path: String,
    gear_id: Option<String>,
) -> AppResult<Extraction> {
    let path = std::path::PathBuf::from(&source_path);
    if !path.is_file() {
        return Err(AppError::validation("Choose a receipt file to read."));
    }

    let loaded = tauri::async_runtime::spawn_blocking(move || document::read(&path))
        .await
        .map_err(|error| AppError::internal(error.to_string()))??;

    let (prompt, images) = match loaded {
        document::Document::Text(text) => (extract::prompt_for_text(&text), Vec::new()),
        document::Document::Image { base64, .. } => (extract::prompt_for_image(), vec![base64]),
    };

    let content = ollama::chat_json(extract::SYSTEM, &prompt, &images, &extract::schema()).await?;
    let suggestions = extract::parse(&content)?;

    Ok(Extraction {
        id: uuid::Uuid::new_v4().to_string(),
        evidence_id: None,
        gear_id,
        model: ollama::model(),
        status: "pending".to_string(),
        fields: suggestions.fields,
        warnings: suggestions.warnings,
        created_at: timestamp(),
    })
}

#[tauri::command]
pub async fn restore_records(state: State<'_, Shared>, backup_dir: String) -> AppResult<()> {
    run(&state, move |shared| {
        let staged = backup::stage_restore(Path::new(&backup_dir), &shared.data_dir)?;
        shared.close_db()?;
        match backup::apply_restore(staged, &shared.db_path, &shared.evidence_dir) {
            Ok(()) => shared.reopen_db(),
            Err(error) => {
                let previous = shared.db_path.with_extension("db.previous");
                if !shared.db_path.exists() && previous.exists() {
                    let _ = std::fs::rename(&previous, &shared.db_path);
                }
                let _ = shared.reopen_db().map_err(|_| lock_error());
                Err(error)
            }
        }
    })
    .await
}

//! A small client for a local Ollama server.
//!
//! ShutterProof talks to `127.0.0.1:11434` (overridable with
//! `SHUTTERPROOF_OLLAMA_URL`) and nowhere else. Receipt images, extracted text,
//! and gear data never leave the machine: the model runs in Ollama on the same
//! computer. Nothing here needs networks, accounts, or API keys.

use std::time::Duration;

use serde::Deserialize;
use serde_json::{json, Value};

use crate::error::{AppError, AppResult};
use crate::models::OllamaStatus;

/// The vision model ShutterProof asks for by default. It reads receipts and
/// warranty cards and answers with structured JSON. Override with
/// `SHUTTERPROOF_OLLAMA_MODEL` to use a different vision model.
pub const DEFAULT_MODEL: &str = "qwen2.5vl:7b";

const DEFAULT_BASE_URL: &str = "http://127.0.0.1:11434";
const STATUS_TIMEOUT: Duration = Duration::from_secs(3);
const CHAT_TIMEOUT: Duration = Duration::from_secs(180);

fn base_url() -> String {
    env_override("SHUTTERPROOF_OLLAMA_URL").unwrap_or_else(|| DEFAULT_BASE_URL.to_string())
}

/// The model name the app asks for, from the environment or the built-in default.
pub fn model() -> String {
    env_override("SHUTTERPROOF_OLLAMA_MODEL").unwrap_or_else(|| DEFAULT_MODEL.to_string())
}

fn env_override(key: &str) -> Option<String> {
    std::env::var(key)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn client(timeout: Duration) -> AppResult<reqwest::Client> {
    reqwest::Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|error| {
            AppError::internal(format!("could not start the local model client: {error}"))
        })
}

#[derive(Deserialize)]
struct VersionBody {
    version: Option<String>,
}

#[derive(Deserialize)]
struct TagsBody {
    #[serde(default)]
    models: Vec<TagModel>,
}

#[derive(Deserialize)]
struct TagModel {
    #[serde(default)]
    name: String,
    #[serde(default)]
    model: Option<String>,
}

/// True when any pulled tag matches the requested model, with or without a tag.
fn matches_model(models: &[TagModel], wanted: &str) -> bool {
    let wanted = wanted.trim();
    models.iter().any(|entry| {
        entry.name == wanted
            || entry.model.as_deref() == Some(wanted)
            || entry.name.starts_with(&format!("{wanted}:"))
            || base_name(&entry.name) == wanted
    })
}

fn base_name(name: &str) -> &str {
    name.split(':').next().unwrap_or(name)
}

/// Checks whether Ollama is up and the requested model is pulled. Never fails:
/// problems are reported through the returned status so the UI can guide setup.
pub async fn status() -> OllamaStatus {
    let wanted = model();

    let http = match client(STATUS_TIMEOUT) {
        Ok(http) => http,
        Err(error) => return unavailable(wanted, error.to_string()),
    };
    let root = base_url();

    let version = match http.get(format!("{root}/api/version")).send().await {
        Ok(response) if response.status().is_success() => response
            .json::<VersionBody>()
            .await
            .ok()
            .and_then(|body| body.version),
        _ => {
            return OllamaStatus {
                available: false,
                model: wanted,
                model_present: false,
                version: None,
                message: "Ollama is not running on this device. Start it to read receipts automatically, or type the details in by hand.".to_string(),
            }
        }
    };

    let model_present = match http.get(format!("{root}/api/tags")).send().await {
        Ok(response) if response.status().is_success() => response
            .json::<TagsBody>()
            .await
            .map(|body| matches_model(&body.models, &wanted))
            .unwrap_or(false),
        _ => false,
    };

    let message = if model_present {
        format!("Ready. {wanted} is installed and runs on this device.")
    } else {
        format!("Ollama is running, but {wanted} is not installed yet. Run `ollama pull {wanted}`, then check again.")
    };

    OllamaStatus {
        available: true,
        model: wanted,
        model_present,
        version,
        message,
    }
}

fn unavailable(model: String, message: String) -> OllamaStatus {
    OllamaStatus {
        available: false,
        model,
        model_present: false,
        version: None,
        message,
    }
}

/// Asks the model to read a document and answer with a single JSON object.
/// `images` are base64-encoded JPEG/PNG bytes; empty for text-only prompts.
/// `schema` constrains the reply to the shape the caller expects.
pub async fn chat_json(
    system: &str,
    prompt: &str,
    images: &[String],
    schema: &Value,
) -> AppResult<String> {
    let http = client(CHAT_TIMEOUT)?;

    let mut user = json!({ "role": "user", "content": prompt });
    if !images.is_empty() {
        user["images"] = json!(images);
    }

    let body = json!({
        "model": model(),
        "stream": false,
        "format": schema,
        "options": { "temperature": 0 },
        "messages": [
            { "role": "system", "content": system },
            user,
        ],
    });

    let response = http
        .post(format!("{}/api/chat", base_url()))
        .json(&body)
        .send()
        .await
        .map_err(|_| {
            AppError::internal(
                "Could not reach the local model. Check that Ollama is running, then try again.",
            )
        })?;

    if !response.status().is_success() {
        return Err(AppError::internal(
            "The local model rejected the request. Check that the model is installed and try again.",
        ));
    }

    let payload = response
        .json::<ChatBody>()
        .await
        .map_err(|_| AppError::internal("The local model sent back something unreadable."))?;

    payload
        .message
        .map(|message| message.content)
        .filter(|content| !content.trim().is_empty())
        .ok_or_else(|| AppError::internal("The local model returned an empty answer."))
}

#[derive(Deserialize)]
struct ChatBody {
    message: Option<ChatMessage>,
}

#[derive(Deserialize)]
struct ChatMessage {
    #[serde(default)]
    content: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_model_accepts_bare_and_tagged_names() {
        let models = vec![
            TagModel {
                name: "llama3.2:latest".to_string(),
                model: None,
            },
            TagModel {
                name: "qwen2.5vl:7b".to_string(),
                model: None,
            },
        ];
        assert!(matches_model(&models, "qwen2.5vl:7b"));
        assert!(matches_model(&models, "qwen2.5vl"));
        assert!(!matches_model(&models, "qwen2.5vl:32b"));
        assert!(!matches_model(&models, "gemma3"));
    }
}

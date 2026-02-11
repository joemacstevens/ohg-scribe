// src-tauri/src/commands/anthropic.rs
// Commands for calling the Anthropic Claude API

use log::{info, error};
use reqwest::header::{HeaderMap, HeaderValue, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AnthropicError {
    #[error("API key not provided")]
    NoApiKey,
    #[error("Request failed: {0}")]
    RequestFailed(String),
    #[error("API error: {0}")]
    ApiError(String),
}

impl serde::Serialize for AnthropicError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Serialize)]
struct AnthropicMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct AnthropicRequest {
    model: String,
    max_tokens: u32,
    system: String,
    messages: Vec<AnthropicMessage>,
}

#[derive(Deserialize)]
struct ContentBlock {
    #[serde(rename = "type")]
    content_type: String,
    text: Option<String>,
}

#[derive(Deserialize)]
struct AnthropicResponse {
    content: Vec<ContentBlock>,
}

#[derive(Deserialize)]
struct AnthropicErrorResponse {
    error: AnthropicErrorDetail,
}

#[derive(Deserialize)]
struct AnthropicErrorDetail {
    message: String,
}

/// Generate minutes using Claude API
#[tauri::command]
pub async fn generate_with_claude(
    api_key: String,
    system_prompt: String,
    user_prompt: String,
    model: Option<String>,
    max_tokens: Option<u32>,
) -> Result<String, AnthropicError> {
    info!("Generating content with Claude...");

    if api_key.is_empty() {
        return Err(AnthropicError::NoApiKey);
    }

    let model_name = model.unwrap_or_else(|| "claude-sonnet-4-20250514".to_string());
    let tokens = max_tokens.unwrap_or(16000);

    let client = reqwest::Client::new();
    
    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    headers.insert("x-api-key", HeaderValue::from_str(&api_key).map_err(|e| AnthropicError::RequestFailed(e.to_string()))?);
    headers.insert("anthropic-version", HeaderValue::from_static("2023-06-01"));

    let request_body = AnthropicRequest {
        model: model_name.clone(),
        max_tokens: tokens,
        system: system_prompt,
        messages: vec![
            AnthropicMessage {
                role: "user".to_string(),
                content: user_prompt,
            }
        ],
    };

    info!("Sending request to Anthropic API (model: {})", model_name);

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .headers(headers)
        .json(&request_body)
        .send()
        .await
        .map_err(|e| AnthropicError::RequestFailed(e.to_string()))?;

    let status = response.status();
    
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        error!("Anthropic API error ({}): {}", status, error_text);
        
        // Try to parse error response
        if let Ok(error_response) = serde_json::from_str::<AnthropicErrorResponse>(&error_text) {
            return Err(AnthropicError::ApiError(error_response.error.message));
        }
        
        return Err(AnthropicError::ApiError(format!("Status {}: {}", status, error_text)));
    }

    let api_response: AnthropicResponse = response
        .json()
        .await
        .map_err(|e| AnthropicError::RequestFailed(format!("Failed to parse response: {}", e)))?;

    // Extract text from content blocks
    let text = api_response
        .content
        .iter()
        .filter_map(|block| {
            if block.content_type == "text" {
                block.text.clone()
            } else {
                None
            }
        })
        .collect::<Vec<_>>()
        .join("");

    if text.is_empty() {
        return Err(AnthropicError::ApiError("No text content in response".to_string()));
    }

    info!("Claude generated {} characters", text.len());
    Ok(text)
}

/// Refine text using Claude API (faster model)
#[tauri::command]
pub async fn refine_with_claude(
    api_key: String,
    text: String,
    instruction: String,
) -> Result<String, AnthropicError> {
    info!("Refining text with Claude Haiku...");

    if api_key.is_empty() {
        return Err(AnthropicError::NoApiKey);
    }

    let client = reqwest::Client::new();
    
    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    headers.insert("x-api-key", HeaderValue::from_str(&api_key).map_err(|e| AnthropicError::RequestFailed(e.to_string()))?);
    headers.insert("anthropic-version", HeaderValue::from_static("2023-06-01"));

    let request_body = AnthropicRequest {
        model: "claude-3-5-haiku-20241022".to_string(),
        max_tokens: 4000,
        system: "You are a helpful editor. Refine the text according to the user's instruction. Output only the refined text, no quotes or preamble.".to_string(),
        messages: vec![
            AnthropicMessage {
                role: "user".to_string(),
                content: format!("Text: \"{}\"\n\nInstruction: {}", text, instruction),
            }
        ],
    };

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .headers(headers)
        .json(&request_body)
        .send()
        .await
        .map_err(|e| AnthropicError::RequestFailed(e.to_string()))?;

    let status = response.status();
    
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        error!("Anthropic API error ({}): {}", status, error_text);
        return Err(AnthropicError::ApiError(format!("Status {}: {}", status, error_text)));
    }

    let api_response: AnthropicResponse = response
        .json()
        .await
        .map_err(|e| AnthropicError::RequestFailed(format!("Failed to parse response: {}", e)))?;

    let text = api_response
        .content
        .iter()
        .filter_map(|block| {
            if block.content_type == "text" {
                block.text.clone()
            } else {
                None
            }
        })
        .collect::<Vec<_>>()
        .join("");

    info!("Claude refined text ({} chars)", text.len());
    Ok(text)
}

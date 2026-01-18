// src-tauri/src/commands/history.rs
// Commands for storing and retrieving transcription history

use log::{info, error};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum HistoryError {
    #[error("Failed to access history directory: {0}")]
    DirectoryError(String),
    #[error("Failed to read history: {0}")]
    ReadError(String),
    #[error("Failed to write history: {0}")]
    WriteError(String),
    #[error("Entry not found: {0}")]
    NotFound(String),
}

impl serde::Serialize for HistoryError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

// Get the history directory path
fn get_history_dir(app: &AppHandle) -> Result<PathBuf, HistoryError> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| HistoryError::DirectoryError(e.to_string()))?;
    
    let history_dir = app_data_dir.join("history");
    
    // Create directory if it doesn't exist
    if !history_dir.exists() {
        fs::create_dir_all(&history_dir)
            .map_err(|e| HistoryError::DirectoryError(e.to_string()))?;
        info!("Created history directory: {:?}", history_dir);
    }
    
    Ok(history_dir)
}

/// Save a history entry to disk
#[tauri::command]
pub async fn save_history_entry(app: AppHandle, entry: String) -> Result<(), HistoryError> {
    let history_dir = get_history_dir(&app)?;
    
    // Parse to get the ID
    let parsed: serde_json::Value = serde_json::from_str(&entry)
        .map_err(|e| HistoryError::WriteError(format!("Invalid JSON: {}", e)))?;
    
    let id = parsed.get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| HistoryError::WriteError("Missing id field".to_string()))?;
    
    let file_path = history_dir.join(format!("{}.json", id));
    
    fs::write(&file_path, &entry)
        .map_err(|e| HistoryError::WriteError(e.to_string()))?;
    
    info!("Saved history entry: {}", id);
    Ok(())
}

/// Get list of all history entries (summaries only)
#[tauri::command]
pub async fn get_history_list(app: AppHandle) -> Result<String, HistoryError> {
    let history_dir = get_history_dir(&app)?;
    
    let mut entries: Vec<serde_json::Value> = Vec::new();
    
    if let Ok(dir_entries) = fs::read_dir(&history_dir) {
        for dir_entry in dir_entries.flatten() {
            let path = dir_entry.path();
            if path.extension().map(|e| e == "json").unwrap_or(false) {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&content) {
                        // Create summary (subset of full entry)
                        let preview = parsed.get("transcript")
                            .and_then(|t| t.get("segments"))
                            .and_then(|s| s.as_array())
                            .and_then(|arr| arr.first())
                            .and_then(|seg| seg.get("text"))
                            .and_then(|t| t.as_str())
                            .map(|s| {
                                if s.len() > 100 {
                                    format!("{}...", &s[..100])
                                } else {
                                    s.to_string()
                                }
                            })
                            .unwrap_or_default();
                        
                        let summary = serde_json::json!({
                            "id": parsed.get("id"),
                            "filename": parsed.get("filename"),
                            "transcribedAt": parsed.get("transcribedAt"),
                            "speakerCount": parsed.get("speakerCount"),
                            "wordCount": parsed.get("wordCount"),
                            "preview": preview
                        });
                        
                        entries.push(summary);
                    }
                }
            }
        }
    }
    
    // Sort by date (newest first)
    entries.sort_by(|a, b| {
        let date_a = a.get("transcribedAt").and_then(|d| d.as_str()).unwrap_or("");
        let date_b = b.get("transcribedAt").and_then(|d| d.as_str()).unwrap_or("");
        date_b.cmp(date_a)
    });
    
    info!("Retrieved {} history entries", entries.len());
    serde_json::to_string(&entries)
        .map_err(|e| HistoryError::ReadError(e.to_string()))
}

/// Get a single history entry by ID
#[tauri::command]
pub async fn get_history_entry(app: AppHandle, id: String) -> Result<Option<String>, HistoryError> {
    let history_dir = get_history_dir(&app)?;
    let file_path = history_dir.join(format!("{}.json", id));
    
    if !file_path.exists() {
        return Ok(None);
    }
    
    let content = fs::read_to_string(&file_path)
        .map_err(|e| HistoryError::ReadError(e.to_string()))?;
    
    info!("Retrieved history entry: {}", id);
    Ok(Some(content))
}

/// Delete a history entry
#[tauri::command]
pub async fn delete_history_entry(app: AppHandle, id: String) -> Result<(), HistoryError> {
    let history_dir = get_history_dir(&app)?;
    let file_path = history_dir.join(format!("{}.json", id));
    
    if file_path.exists() {
        fs::remove_file(&file_path)
            .map_err(|e| HistoryError::WriteError(e.to_string()))?;
        info!("Deleted history entry: {}", id);
    }
    
    Ok(())
}

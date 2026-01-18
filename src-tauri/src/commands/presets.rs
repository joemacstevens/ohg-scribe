// src-tauri/src/commands/presets.rs
// Commands for storing and retrieving boost word presets

use log::{info, error};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum PresetError {
    #[error("Failed to access presets directory: {0}")]
    DirectoryError(String),
    #[error("Failed to read presets: {0}")]
    ReadError(String),
    #[error("Failed to write preset: {0}")]
    WriteError(String),
}

impl serde::Serialize for PresetError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

// Get the presets directory path
fn get_presets_dir(app: &AppHandle) -> Result<PathBuf, PresetError> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| PresetError::DirectoryError(e.to_string()))?;
    
    let presets_dir = app_data_dir.join("presets");
    
    // Create directory if it doesn't exist
    if !presets_dir.exists() {
        fs::create_dir_all(&presets_dir)
            .map_err(|e| PresetError::DirectoryError(e.to_string()))?;
        info!("Created presets directory: {:?}", presets_dir);
    }
    
    Ok(presets_dir)
}

/// Save a preset to disk
#[tauri::command]
pub async fn save_preset(app: AppHandle, preset: String) -> Result<(), PresetError> {
    let presets_dir = get_presets_dir(&app)?;
    
    // Parse to get the ID
    let parsed: serde_json::Value = serde_json::from_str(&preset)
        .map_err(|e| PresetError::WriteError(format!("Invalid JSON: {}", e)))?;
    
    let id = parsed.get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| PresetError::WriteError("Missing id field".to_string()))?;
    
    let name = parsed.get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("unnamed");
    
    let file_path = presets_dir.join(format!("{}.json", id));
    
    fs::write(&file_path, &preset)
        .map_err(|e| PresetError::WriteError(e.to_string()))?;
    
    info!("Saved preset: {} ({})", name, id);
    Ok(())
}

/// Get all presets
#[tauri::command]
pub async fn get_presets(app: AppHandle) -> Result<String, PresetError> {
    let presets_dir = get_presets_dir(&app)?;
    
    let mut presets: Vec<serde_json::Value> = Vec::new();
    
    if let Ok(dir_entries) = fs::read_dir(&presets_dir) {
        for dir_entry in dir_entries.flatten() {
            let path = dir_entry.path();
            if path.extension().map(|e| e == "json").unwrap_or(false) {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&content) {
                        presets.push(parsed);
                    }
                }
            }
        }
    }
    
    // Sort by name
    presets.sort_by(|a, b| {
        let name_a = a.get("name").and_then(|n| n.as_str()).unwrap_or("");
        let name_b = b.get("name").and_then(|n| n.as_str()).unwrap_or("");
        name_a.cmp(name_b)
    });
    
    info!("Retrieved {} presets", presets.len());
    serde_json::to_string(&presets)
        .map_err(|e| PresetError::ReadError(e.to_string()))
}

/// Delete a preset
#[tauri::command]
pub async fn delete_preset(app: AppHandle, id: String) -> Result<(), PresetError> {
    let presets_dir = get_presets_dir(&app)?;
    let file_path = presets_dir.join(format!("{}.json", id));
    
    if file_path.exists() {
        fs::remove_file(&file_path)
            .map_err(|e| PresetError::WriteError(e.to_string()))?;
        info!("Deleted preset: {}", id);
    }
    
    Ok(())
}

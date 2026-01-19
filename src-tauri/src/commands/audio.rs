// src-tauri/src/commands/audio.rs
// Audio file storage for playback in transcript view

use log::info;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AudioError {
    #[error("Failed to get app data directory")]
    NoAppDir,
    #[error("Failed to copy audio: {0}")]
    CopyFailed(String),
    #[error("Source file not found: {0}")]
    NotFound(String),
}

impl serde::Serialize for AudioError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// Copy audio file to app data directory for persistent storage
/// Returns the path to the stored audio file
#[tauri::command]
pub async fn store_audio_file(
    source_path: String,
    history_id: String,
    app_handle: tauri::AppHandle,
) -> Result<String, AudioError> {
    info!("Storing audio file for history entry: {}", history_id);
    
    // Get app data directory
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|_| AudioError::NoAppDir)?;
    
    // Create audio subdirectory
    let audio_dir = app_data_dir.join("audio");
    fs::create_dir_all(&audio_dir)
        .map_err(|e| AudioError::CopyFailed(format!("Failed to create audio dir: {}", e)))?;
    
    // Determine file extension from source
    let source = PathBuf::from(&source_path);
    let extension = source
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("mp3");
    
    // Create destination path with history ID as filename
    let dest_filename = format!("{}.{}", history_id, extension);
    let dest_path = audio_dir.join(&dest_filename);
    
    // Check source exists
    if !source.exists() {
        return Err(AudioError::NotFound(source_path));
    }
    
    // Copy file
    fs::copy(&source, &dest_path)
        .map_err(|e| AudioError::CopyFailed(format!("Copy failed: {}", e)))?;
    
    let dest_str = dest_path.to_string_lossy().to_string();
    info!("Audio stored at: {}", dest_str);
    
    Ok(dest_str)
}

/// Delete stored audio file when history entry is deleted
#[tauri::command]
pub async fn delete_audio_file(
    audio_path: String,
) -> Result<(), AudioError> {
    let path = PathBuf::from(&audio_path);
    
    if path.exists() {
        fs::remove_file(&path)
            .map_err(|e| AudioError::CopyFailed(format!("Delete failed: {}", e)))?;
        info!("Deleted audio file: {}", audio_path);
    }
    
    Ok(())
}

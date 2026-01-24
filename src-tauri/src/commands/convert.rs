use log::{info, error};
use std::path::PathBuf;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use tempfile::TempDir;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ConvertError {
    #[error("FFmpeg execution failed: {0}")]
    FfmpegFailed(String),
    #[error("Failed to create temp directory: {0}")]
    TempDirError(#[from] std::io::Error),
    #[error("Invalid file path: {0}")]
    InvalidPath(String),
}

impl serde::Serialize for ConvertError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// Result of audio conversion
#[derive(serde::Serialize)]
pub struct ConversionResult {
    pub output_path: String,
    pub temp_dir: String,
}

/// Convert a video or audio file to a compressed MP3 suitable for transcription.
/// Settings: mono, 16kHz, 32kbps - optimized for small file size while maintaining transcription accuracy.
#[tauri::command]
pub async fn convert_to_audio(
    app: AppHandle,
    input_path: String,
) -> Result<ConversionResult, ConvertError> {
    info!("Starting conversion for: {}", input_path);
    
    let input = PathBuf::from(&input_path);
    
    // Validate input file exists
    if !input.exists() {
        error!("Input file does not exist: {}", input_path);
        return Err(ConvertError::InvalidPath(format!("File does not exist: {}", input_path)));
    }
    
    info!("Input file exists: {}", input_path);
    
    // Get the filename without extension
    let filename = input
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or_else(|| {
            error!("Invalid filename: {}", input_path);
            ConvertError::InvalidPath(format!("Invalid filename: {}", input_path))
        })?;
    
    info!("Filename: {}", filename);
    
    // Create a temp directory for the output
    let temp_dir = TempDir::new()?;
    let temp_dir_path = temp_dir.path().to_string_lossy().to_string();
    
    info!("Created temp directory: {}", temp_dir_path);
    
    // Keep the temp dir alive by leaking it (we'll clean up later via the frontend)
    let temp_dir = Box::leak(Box::new(temp_dir));
    
    let output_path = temp_dir.path().join(format!("{}.m4a", filename));
    let output_str = output_path.to_string_lossy().to_string();
    
    info!("Output path: {}", output_str);
    
    // Get the shell plugin to run FFmpeg
    let shell = app.shell();
    
    info!("Running FFmpeg...");
    
    // Build FFmpeg command arguments:
    // -i {input}    Input file
    // -vn           Strip video track
    // -ac 1         Mono channel
    // -ar 16000     16kHz sample rate
    // -c:a aac      Use AAC codec (better seeking than mp3 at low bitrates)
    // -b:a 32k      32kbps bitrate
    // -y            Overwrite output without asking
    let output = shell
        .sidecar("ffmpeg")
        .map_err(|e| {
            error!("Failed to create FFmpeg sidecar: {}", e);
            ConvertError::FfmpegFailed(format!("Failed to start FFmpeg: {}", e))
        })?
        .args([
            "-i", &input_path,
            "-vn",
            "-ac", "1",
            "-ar", "16000",
            "-c:a", "aac",
            "-b:a", "32k",
            "-y",
            &output_str,
        ])
        .output()
        .await
        .map_err(|e| {
            error!("FFmpeg execution failed: {}", e);
            ConvertError::FfmpegFailed(format!("FFmpeg failed to execute: {}", e))
        })?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        error!("FFmpeg exited with code {:?}", output.status.code());
        error!("FFmpeg stderr: {}", stderr);
        error!("FFmpeg stdout: {}", stdout);
        return Err(ConvertError::FfmpegFailed(format!(
            "FFmpeg exited with code {:?}: {}",
            output.status.code(),
            stderr
        )));
    }
    
    // Verify output file was created
    if !output_path.exists() {
        error!("Output file was not created: {}", output_str);
        return Err(ConvertError::FfmpegFailed("Output file was not created".to_string()));
    }
    
    let output_size = std::fs::metadata(&output_path)
        .map(|m| m.len())
        .unwrap_or(0);
    
    info!("Conversion successful! Output size: {} bytes", output_size);
    
    Ok(ConversionResult {
        output_path: output_str,
        temp_dir: temp_dir_path,
    })
}

/// Clean up a temporary directory after transcription is complete
#[tauri::command]
pub async fn cleanup_temp_dir(temp_dir: String) -> Result<(), String> {
    info!("Cleaning up temp dir: {}", temp_dir);
    let path = PathBuf::from(&temp_dir);
    if path.exists() && path.is_dir() {
        std::fs::remove_dir_all(&path).map_err(|e| e.to_string())?;
        info!("Temp dir cleaned up successfully");
    }
    Ok(())
}

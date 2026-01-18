use log::info;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;
use thiserror::Error;
use uuid::Uuid;
use chrono::Utc;

#[derive(Error, Debug)]
pub enum VocabularyError {
    #[error("Directory error: {0}")]
    DirectoryError(String),
    #[error("File error: {0}")]
    FileError(String),
    #[error("Parse error: {0}")]
    ParseError(String),
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Cannot modify system vocabulary")]
    SystemVocabulary,
}

impl serde::Serialize for VocabularyError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Vocabulary {
    pub id: String,
    pub name: String,
    pub category: String,
    pub terms: Vec<String>,
    #[serde(default)]
    pub is_system: bool,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VocabularyCategory {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub is_system: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VocabularyData {
    pub categories: Vec<VocabularyCategory>,
    pub vocabularies: Vec<Vocabulary>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemVocabFile {
    pub category: VocabularyCategory,
    pub vocabularies: Vec<Vocabulary>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserVocabFile {
    pub categories: Vec<VocabularyCategory>,
    pub vocabularies: Vec<Vocabulary>,
}

fn get_user_vocab_dir(app: &AppHandle) -> Result<PathBuf, VocabularyError> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| VocabularyError::DirectoryError(e.to_string()))?;
    
    let vocab_dir = app_data_dir.join("vocabularies").join("user");
    
    if !vocab_dir.exists() {
        fs::create_dir_all(&vocab_dir)
            .map_err(|e| VocabularyError::DirectoryError(e.to_string()))?;
        info!("Created user vocabulary directory: {:?}", vocab_dir);
    }
    
    Ok(vocab_dir)
}

fn get_system_vocab_dir(app: &AppHandle) -> Option<PathBuf> {
    // In development, check relative to project
    let dev_path = PathBuf::from("vocabularies/system");
    if dev_path.exists() {
        return Some(dev_path);
    }
    
    // In production, check resource dir
    if let Ok(resource_dir) = app.path().resource_dir() {
        let prod_path = resource_dir.join("vocabularies/system");
        if prod_path.exists() {
            return Some(prod_path);
        }
    }
    
    None
}

fn load_user_vocabularies(app: &AppHandle) -> Result<UserVocabFile, VocabularyError> {
    let user_dir = get_user_vocab_dir(app)?;
    let user_file = user_dir.join("vocabularies.json");
    
    if user_file.exists() {
        let content = fs::read_to_string(&user_file)
            .map_err(|e| VocabularyError::FileError(e.to_string()))?;
        let data: UserVocabFile = serde_json::from_str(&content)
            .map_err(|e| VocabularyError::ParseError(e.to_string()))?;
        Ok(data)
    } else {
        // Return default empty structure
        Ok(UserVocabFile {
            categories: vec![VocabularyCategory {
                id: "my-vocabularies".to_string(),
                name: "My Vocabularies".to_string(),
                is_system: false,
            }],
            vocabularies: vec![],
        })
    }
}

fn save_user_vocabularies(app: &AppHandle, data: &UserVocabFile) -> Result<(), VocabularyError> {
    let user_dir = get_user_vocab_dir(app)?;
    let user_file = user_dir.join("vocabularies.json");
    
    let content = serde_json::to_string_pretty(data)
        .map_err(|e| VocabularyError::ParseError(e.to_string()))?;
    
    fs::write(&user_file, content)
        .map_err(|e| VocabularyError::FileError(e.to_string()))?;
    
    info!("Saved user vocabularies to: {:?}", user_file);
    Ok(())
}

#[tauri::command]
pub async fn load_vocabularies(app: AppHandle) -> Result<VocabularyData, VocabularyError> {
    info!("Loading vocabularies...");
    
    let mut all_categories: Vec<VocabularyCategory> = vec![];
    let mut all_vocabularies: Vec<Vocabulary> = vec![];
    
    // Load system vocabularies
    if let Some(system_dir) = get_system_vocab_dir(&app) {
        info!("Loading system vocabularies from: {:?}", system_dir);
        
        if let Ok(entries) = fs::read_dir(&system_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().map_or(false, |e| e == "json") {
                    if let Ok(content) = fs::read_to_string(&path) {
                        if let Ok(mut file_data) = serde_json::from_str::<SystemVocabFile>(&content) {
                            // Mark category as system
                            file_data.category.is_system = true;
                            all_categories.push(file_data.category.clone());
                            
                            // Mark vocabularies as system and set category
                            for mut vocab in file_data.vocabularies {
                                vocab.is_system = true;
                                vocab.category = file_data.category.id.clone();
                                all_vocabularies.push(vocab);
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Load user vocabularies
    let user_data = load_user_vocabularies(&app)?;
    all_categories.extend(user_data.categories);
    all_vocabularies.extend(user_data.vocabularies);
    
    info!("Loaded {} categories and {} vocabularies", all_categories.len(), all_vocabularies.len());
    
    Ok(VocabularyData {
        categories: all_categories,
        vocabularies: all_vocabularies,
    })
}

#[tauri::command]
pub async fn create_vocabulary(
    app: AppHandle,
    name: String,
    category: String,
    terms: Vec<String>,
) -> Result<Vocabulary, VocabularyError> {
    info!("Creating vocabulary: {}", name);
    
    let now = Utc::now().to_rfc3339();
    let vocab = Vocabulary {
        id: Uuid::new_v4().to_string(),
        name,
        category,
        terms,
        is_system: false,
        created_at: now.clone(),
        updated_at: now,
    };
    
    let mut user_data = load_user_vocabularies(&app)?;
    user_data.vocabularies.push(vocab.clone());
    save_user_vocabularies(&app, &user_data)?;
    
    Ok(vocab)
}

#[tauri::command]
pub async fn update_vocabulary(
    app: AppHandle,
    id: String,
    name: Option<String>,
    category: Option<String>,
    terms: Option<Vec<String>>,
) -> Result<Vocabulary, VocabularyError> {
    info!("Updating vocabulary: {}", id);
    
    let mut user_data = load_user_vocabularies(&app)?;
    
    let vocab = user_data.vocabularies.iter_mut()
        .find(|v| v.id == id)
        .ok_or_else(|| VocabularyError::NotFound(format!("Vocabulary {} not found", id)))?;
    
    if vocab.is_system {
        return Err(VocabularyError::SystemVocabulary);
    }
    
    if let Some(n) = name {
        vocab.name = n;
    }
    if let Some(c) = category {
        vocab.category = c;
    }
    if let Some(t) = terms {
        vocab.terms = t;
    }
    vocab.updated_at = Utc::now().to_rfc3339();
    
    let updated = vocab.clone();
    save_user_vocabularies(&app, &user_data)?;
    
    Ok(updated)
}

#[tauri::command]
pub async fn delete_vocabulary(app: AppHandle, id: String) -> Result<(), VocabularyError> {
    info!("Deleting vocabulary: {}", id);
    
    let mut user_data = load_user_vocabularies(&app)?;
    
    // Check if it exists and is not system
    let vocab = user_data.vocabularies.iter()
        .find(|v| v.id == id);
    
    if let Some(v) = vocab {
        if v.is_system {
            return Err(VocabularyError::SystemVocabulary);
        }
    } else {
        return Err(VocabularyError::NotFound(format!("Vocabulary {} not found", id)));
    }
    
    user_data.vocabularies.retain(|v| v.id != id);
    save_user_vocabularies(&app, &user_data)?;
    
    Ok(())
}

#[tauri::command]
pub async fn duplicate_vocabulary(
    app: AppHandle,
    id: String,
    new_name: String,
) -> Result<Vocabulary, VocabularyError> {
    info!("Duplicating vocabulary {} as {}", id, new_name);
    
    // Load all vocabularies to find the source
    let all_data = load_vocabularies(app.clone()).await?;
    
    let source = all_data.vocabularies.iter()
        .find(|v| v.id == id)
        .ok_or_else(|| VocabularyError::NotFound(format!("Vocabulary {} not found", id)))?;
    
    let now = Utc::now().to_rfc3339();
    let new_vocab = Vocabulary {
        id: Uuid::new_v4().to_string(),
        name: new_name,
        category: "my-vocabularies".to_string(), // Always duplicate to user category
        terms: source.terms.clone(),
        is_system: false,
        created_at: now.clone(),
        updated_at: now,
    };
    
    let mut user_data = load_user_vocabularies(&app)?;
    user_data.vocabularies.push(new_vocab.clone());
    save_user_vocabularies(&app, &user_data)?;
    
    Ok(new_vocab)
}

#[tauri::command]
pub async fn create_vocabulary_category(
    app: AppHandle,
    name: String,
) -> Result<VocabularyCategory, VocabularyError> {
    info!("Creating category: {}", name);
    
    let category = VocabularyCategory {
        id: name.to_lowercase().replace(' ', "-"),
        name,
        is_system: false,
    };
    
    let mut user_data = load_user_vocabularies(&app)?;
    user_data.categories.push(category.clone());
    save_user_vocabularies(&app, &user_data)?;
    
    Ok(category)
}

#[tauri::command]
pub async fn export_vocabularies(app: AppHandle) -> Result<String, VocabularyError> {
    let user_data = load_user_vocabularies(&app)?;
    serde_json::to_string_pretty(&user_data)
        .map_err(|e| VocabularyError::ParseError(e.to_string()))
}

#[tauri::command]
pub async fn import_vocabularies(app: AppHandle, json: String) -> Result<i32, VocabularyError> {
    let import_data: UserVocabFile = serde_json::from_str(&json)
        .map_err(|e| VocabularyError::ParseError(e.to_string()))?;
    
    let mut user_data = load_user_vocabularies(&app)?;
    
    let count = import_data.vocabularies.len() as i32;
    
    // Merge categories (avoid duplicates by ID)
    for cat in import_data.categories {
        if !user_data.categories.iter().any(|c| c.id == cat.id) {
            user_data.categories.push(cat);
        }
    }
    
    // Add vocabularies with new IDs to avoid conflicts
    for mut vocab in import_data.vocabularies {
        vocab.id = Uuid::new_v4().to_string();
        vocab.is_system = false;
        user_data.vocabularies.push(vocab);
    }
    
    save_user_vocabularies(&app, &user_data)?;
    
    Ok(count)
}

use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Serialize)]
struct OpenAIRequest {
    model: String,
    max_tokens: u32,
    response_format: ResponseFormat,
    messages: Vec<Message>,
}

#[derive(Serialize)]
struct ResponseFormat {
    #[serde(rename = "type")]
    format_type: String,
}

#[derive(Serialize)]
struct Message {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct OpenAIResponse {
    choices: Vec<Choice>,
}

#[derive(Deserialize)]
struct Choice {
    message: ResponseMessage,
}

#[derive(Deserialize)]
struct ResponseMessage {
    content: String,
}

#[derive(Serialize, Deserialize)]
pub struct ExtractedVocabulary {
    pub categories: Vec<ExtractedCategory>,
    pub suggested_name: String,
}

#[derive(Serialize, Deserialize)]
pub struct ExtractedCategory {
    pub name: String,
    pub terms: Vec<String>,
}

#[tauri::command]
pub async fn extract_document_text(path: String) -> Result<String, String> {
    let path = Path::new(&path);
    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .ok_or("Could not determine file type")?;

    match extension.as_str() {
        "txt" | "md" => {
            fs::read_to_string(path).map_err(|e| format!("Failed to read file: {}", e))
        }
        "docx" => extract_docx_text(path),
        "pdf" => extract_pdf_text(path),
        "pptx" => extract_pptx_text(path),
        "ppt" => Err("Legacy .ppt files are not supported directly. Please save the file as a .pptx or .pdf and try again.".to_string()),
        _ => Err(format!("Unsupported file type: {}", extension)),
    }
}

fn extract_docx_text(path: &Path) -> Result<String, String> {
    use docx_rs::*;

    let file = fs::read(path).map_err(|e| format!("Failed to read file: {}", e))?;
    let docx = read_docx(&file).map_err(|e| format!("Failed to parse docx: {}", e))?;

    let mut text = String::new();
    for child in docx.document.children {
        if let DocumentChild::Paragraph(p) = child {
            for child in p.children {
                if let ParagraphChild::Run(run) = child {
                    for child in run.children {
                        if let RunChild::Text(t) = child {
                            text.push_str(&t.text);
                        }
                    }
                }
            }
            text.push('\n');
        }
    }

    Ok(text)
}

fn extract_pdf_text(path: &Path) -> Result<String, String> {
    pdf_extract::extract_text(path).map_err(|e| format!("Failed to extract PDF text: {}", e))
}

fn extract_pptx_text(path: &Path) -> Result<String, String> {
    use std::io::Read;
    use zip::ZipArchive;
    use quick_xml::events::Event;
    use quick_xml::reader::Reader;

    let file = fs::File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("Failed to read pptx as zip: {}", e))?;

    let mut text = String::new();
    
    // Iterate over slides 1..100 (arbitrary limit, but robust enough)
    // Or iterate over all file names in zip? 
    // Better to iterate filenames to find 'ppt/slides/slideX.xml'
    
    // Collect slide files and sort them numerically if possible, or just iterate zip
    // Zip iteration order is not guaranteed to be numeric order of slides, but usually is ok for context.
    // Let's filter for valid slide paths.
    
    let mut slide_files: Vec<String> = (0..archive.len())
        .filter_map(|i| {
            let file = archive.by_index(i).ok()?;
            let name = file.name().to_string();
            if name.starts_with("ppt/slides/slide") && name.ends_with(".xml") {
                Some(name)
            } else {
                None
            }
        })
        .collect();

    // Sort naturally: slide1, slide2, ..., slide10
    slide_files.sort_by(|a, b| {
        // extract number: ppt/slides/slide(\d+).xml
        let extract_num = |s: &str| -> u32 {
            s.trim_start_matches("ppt/slides/slide")
                .trim_end_matches(".xml")
                .parse()
                .unwrap_or(0)
        };
        extract_num(a).cmp(&extract_num(b))
    });

    for slide_name in slide_files {
        let mut slide_text = String::new();
        let mut file = archive.by_name(&slide_name).map_err(|e| format!("Failed to read slide {}: {}", slide_name, e))?;
        let mut content = String::new();
        file.read_to_string(&mut content).map_err(|e| format!("Failed to read content of {}: {}", slide_name, e))?;

        let mut reader = Reader::from_str(&content);
        reader.config_mut().trim_text(true);

        let mut buf = Vec::new();

        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Text(e)) => {
                    let txt = e.unescape().unwrap_or_default();
                    slide_text.push_str(&txt);
                    slide_text.push(' ');
                }
                Ok(Event::Eof) => break,
                Err(_) => break, // ignore errors in xml
                _ => (),
            }
            buf.clear();
        }
        
        if !slide_text.trim().is_empty() {
             text.push_str(&format!("--- SLIDE {} ---\n", slide_name));
             text.push_str(&slide_text);
             text.push('\n');
        }
    }

    if text.is_empty() {
         return Err("No text found in presentation slides.".to_string());
    }

    Ok(text)
}

#[tauri::command]
pub async fn extract_vocabulary_terms(
    text: String,
    api_key: String,
) -> Result<ExtractedVocabulary, String> {
    let client = Client::new();

    // Truncate if too long (OpenAI has token limits)
    let truncated = if text.len() > 60000 {
        text[..60000].to_string()
    } else {
        text
    };

    let request = OpenAIRequest {
        model: "gpt-4o-mini".to_string(),
        max_tokens: 4096,
        response_format: ResponseFormat {
            format_type: "json_object".to_string(),
        },
        messages: vec![
            Message {
                role: "system".to_string(),
                content: EXTRACTION_PROMPT.to_string(),
            },
            Message {
                role: "user".to_string(),
                content: format!(
                    "Extract domain-specific terms from this document:\n\n{}",
                    truncated
                ),
            },
        ],
    };

    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("OpenAI API error {}: {}", status, body));
    }

    let response_body: OpenAIResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let content = response_body
        .choices
        .first()
        .ok_or("No response from model")?
        .message
        .content
        .clone();

    serde_json::from_str(&content).map_err(|e| format!("Failed to parse terms: {}", e))
}

const EXTRACTION_PROMPT: &str = r#"You extract domain-specific terms from documents to improve speech-to-text accuracy.

Extract terms in these categories:
1. Drug Names — Generic names, brand names, drug classes
2. Medical Terms — Conditions, procedures, biomarkers
3. Acronyms — Medical and business abbreviations  
4. Industry Terms — Specialized terminology
5. Organizations — Company names, institutions

Guidelines:
- Focus on terms speech-to-text might misrecognize
- Include multi-word phrases (up to 6 words)
- Exclude common words like "patient", "treatment"
- Prioritize proper nouns, acronyms, drug names

Return JSON:
{
  "categories": [
    {"name": "Drug Names", "terms": ["term1", "term2"]},
    {"name": "Medical Terms", "terms": [...]}
  ],
  "suggested_name": "Name based on document content"
}

Only return valid JSON. Omit empty categories. Aim for 20-150 terms."#;

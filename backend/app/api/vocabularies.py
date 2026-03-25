import io
import json
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.config import settings
from app.db.database import get_db
from app.db import models

router = APIRouter()


class CreateVocabularyRequest(BaseModel):
    name: str
    category_id: str
    terms: list[str]


class UpdateVocabularyRequest(BaseModel):
    name: str | None = None
    category_id: str | None = None
    terms: list[str] | None = None


class CreateCategoryRequest(BaseModel):
    name: str


def _vocab_to_dict(v: models.Vocabulary) -> dict:
    return {
        "id": v.id,
        "name": v.name,
        "category": v.category_id,
        "terms": v.terms or [],
        "isSystem": v.is_system,
        "createdAt": v.created_at.isoformat() if v.created_at else None,
        "updatedAt": v.updated_at.isoformat() if v.updated_at else None,
    }


def _cat_to_dict(c: models.VocabularyCategory) -> dict:
    return {"id": c.id, "name": c.name, "isSystem": c.is_system}


@router.get("")
def list_vocabularies(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all categories and vocabularies (system + user-owned)."""
    cats = db.query(models.VocabularyCategory).filter(
        (models.VocabularyCategory.is_system == True) |
        (models.VocabularyCategory.user_email == user["email"])
    ).all()

    vocabs = db.query(models.Vocabulary).filter(
        (models.Vocabulary.is_system == True) |
        (models.Vocabulary.user_email == user["email"])
    ).all()

    return {
        "categories": [_cat_to_dict(c) for c in cats],
        "vocabularies": [_vocab_to_dict(v) for v in vocabs],
    }


@router.post("")
def create_vocabulary(
    body: CreateVocabularyRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    vocab = models.Vocabulary(
        id=str(uuid.uuid4()),
        category_id=body.category_id,
        name=body.name,
        terms=body.terms,
        is_system=False,
        user_email=user["email"],
    )
    db.add(vocab)
    db.commit()
    db.refresh(vocab)
    return _vocab_to_dict(vocab)


@router.put("/{vocab_id}")
def update_vocabulary(
    vocab_id: str,
    body: UpdateVocabularyRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    vocab = db.query(models.Vocabulary).filter(
        models.Vocabulary.id == vocab_id,
        models.Vocabulary.user_email == user["email"],
        models.Vocabulary.is_system == False,
    ).first()
    if not vocab:
        raise HTTPException(status_code=404, detail="Not found or cannot modify system vocabulary")

    if body.name is not None:
        vocab.name = body.name
    if body.category_id is not None:
        vocab.category_id = body.category_id
    if body.terms is not None:
        vocab.terms = body.terms
    vocab.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(vocab)
    return _vocab_to_dict(vocab)


@router.delete("/{vocab_id}")
def delete_vocabulary(
    vocab_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    vocab = db.query(models.Vocabulary).filter(
        models.Vocabulary.id == vocab_id,
        models.Vocabulary.user_email == user["email"],
        models.Vocabulary.is_system == False,
    ).first()
    if not vocab:
        raise HTTPException(status_code=404, detail="Not found or cannot delete system vocabulary")
    db.delete(vocab)
    db.commit()
    return {"ok": True}


@router.post("/{vocab_id}/duplicate")
def duplicate_vocabulary(
    vocab_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    source = db.query(models.Vocabulary).filter(
        (models.Vocabulary.is_system == True) |
        (models.Vocabulary.user_email == user["email"]),
        models.Vocabulary.id == vocab_id,
    ).first()
    if not source:
        raise HTTPException(status_code=404, detail="Not found")

    new_vocab = models.Vocabulary(
        id=str(uuid.uuid4()),
        category_id="my-vocabularies",
        name=f"{source.name} (copy)",
        terms=list(source.terms or []),
        is_system=False,
        user_email=user["email"],
    )
    db.add(new_vocab)
    db.commit()
    db.refresh(new_vocab)
    return _vocab_to_dict(new_vocab)


@router.post("/categories")
def create_category(
    body: CreateCategoryRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cat_id = body.name.lower().replace(" ", "-")
    existing = db.query(models.VocabularyCategory).filter(
        models.VocabularyCategory.id == cat_id
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Category already exists")

    cat = models.VocabularyCategory(
        id=cat_id,
        name=body.name,
        is_system=False,
        user_email=user["email"],
    )
    db.add(cat)
    db.commit()
    return _cat_to_dict(cat)


@router.get("/export")
def export_vocabularies(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cats = db.query(models.VocabularyCategory).filter(
        models.VocabularyCategory.user_email == user["email"]
    ).all()
    vocabs = db.query(models.Vocabulary).filter(
        models.Vocabulary.user_email == user["email"]
    ).all()
    return {
        "categories": [_cat_to_dict(c) for c in cats],
        "vocabularies": [_vocab_to_dict(v) for v in vocabs],
    }


class ImportRequest(BaseModel):
    categories: list[dict]
    vocabularies: list[dict]


@router.post("/import")
def import_vocabularies(
    body: ImportRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing_cat_ids = {
        c.id for c in db.query(models.VocabularyCategory).filter(
            models.VocabularyCategory.user_email == user["email"]
        ).all()
    }

    for cat in body.categories:
        if cat.get("id") not in existing_cat_ids:
            db.add(models.VocabularyCategory(
                id=cat["id"],
                name=cat["name"],
                is_system=False,
                user_email=user["email"],
            ))

    count = 0
    for v in body.vocabularies:
        db.add(models.Vocabulary(
            id=str(uuid.uuid4()),
            category_id=v.get("category", "my-vocabularies"),
            name=v.get("name", "Imported"),
            terms=v.get("terms", []),
            is_system=False,
            user_email=user["email"],
        ))
        count += 1

    db.commit()
    return {"imported": count}


@router.post("/extract-from-document")
async def extract_from_document(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """
    Accept a document upload, extract text, then use Claude to identify
    domain-specific vocabulary terms grouped by category.
    """
    import anthropic as _anthropic

    # Read file content
    content = await file.read()
    filename = file.filename or "document"
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    # Extract text based on file type
    text = ""
    if extension == "txt" or extension == "md":
        text = content.decode("utf-8", errors="replace")
    elif extension == "docx":
        try:
            import docx2txt
            text = docx2txt.process(io.BytesIO(content))
        except ImportError:
            raise HTTPException(
                status_code=422,
                detail="docx2txt not installed. Only .txt and .md files are supported on this deployment."
            )
    elif extension == "pdf":
        try:
            import pdfplumber
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                text = "\n".join(p.extract_text() or "" for p in pdf.pages)
        except ImportError:
            raise HTTPException(
                status_code=422,
                detail="pdfplumber not installed. Only .txt and .md files are supported on this deployment."
            )
    else:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported file type: {extension}. Supported: .txt, .md, .docx, .pdf"
        )

    if not text.strip():
        raise HTTPException(status_code=422, detail="Could not extract text from the file.")

    # Truncate to ~12000 chars to avoid token limits
    text = text[:12000]

    # Call Claude to extract vocabulary
    client = _anthropic.Anthropic(api_key=settings.anthropic_api_key)

    prompt = f"""You are a medical transcription specialist. Analyze the following document and extract domain-specific terminology that would be useful for boosting transcription accuracy.

Extract:
1. Drug/medication names (brand and generic)
2. Medical conditions and diseases
3. Procedures and treatments
4. Medical acronyms and abbreviations
5. Organization/company names
6. Technical jargon specific to this document

Return ONLY a JSON object in this exact format:
{{
  "suggested_name": "Brief descriptive name for this vocabulary set",
  "categories": [
    {{
      "name": "Category Name",
      "terms": ["term1", "term2", "term3"]
    }}
  ]
}}

Document:
{text}"""

    message = client.messages.create(
        model="claude-3-haiku-20240307",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}]
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.replace("```json", "").replace("```", "").strip()

    try:
        result = json.loads(raw)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse AI response: {e}")

    return result


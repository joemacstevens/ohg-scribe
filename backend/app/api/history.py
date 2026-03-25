from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.db.database import get_db
from app.db import models

router = APIRouter()


class SaveHistoryRequest(BaseModel):
    id: str
    filename: str
    speaker_count: int | None = None
    word_count: int | None = None
    data: dict  # Full transcript data


@router.get("")
def list_history(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all history entries for the current user (summaries, newest first)."""
    entries = (
        db.query(models.HistoryEntry)
        .filter(models.HistoryEntry.user_email == user["email"])
        .order_by(models.HistoryEntry.transcribed_at.desc())
        .all()
    )
    return [
        {
            "id": e.id,
            "filename": e.filename,
            "transcribedAt": e.transcribed_at.isoformat() if e.transcribed_at else None,
            "speakerCount": e.speaker_count,
            "wordCount": e.word_count,
            # Short preview from first segment text
            "preview": _preview(e.data),
        }
        for e in entries
    ]


@router.get("/{entry_id}")
def get_history_entry(
    entry_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single history entry with full data."""
    entry = db.query(models.HistoryEntry).filter(
        models.HistoryEntry.id == entry_id,
        models.HistoryEntry.user_email == user["email"],
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Not found")
    return {
        "id": entry.id,
        "filename": entry.filename,
        "transcribedAt": entry.transcribed_at.isoformat() if entry.transcribed_at else None,
        "speakerCount": entry.speaker_count,
        "wordCount": entry.word_count,
        "data": entry.data,
    }


@router.post("")
def save_history_entry(
    body: SaveHistoryRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save or update a history entry."""
    existing = db.query(models.HistoryEntry).filter(
        models.HistoryEntry.id == body.id,
        models.HistoryEntry.user_email == user["email"],
    ).first()

    if existing:
        existing.filename = body.filename
        existing.speaker_count = body.speaker_count
        existing.word_count = body.word_count
        existing.data = body.data
        db.commit()
        return {"id": existing.id}

    entry = models.HistoryEntry(
        id=body.id,
        user_email=user["email"],
        filename=body.filename,
        speaker_count=body.speaker_count,
        word_count=body.word_count,
        data=body.data,
    )
    db.add(entry)
    db.commit()
    return {"id": entry.id}


@router.delete("/{entry_id}")
def delete_history_entry(
    entry_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = db.query(models.HistoryEntry).filter(
        models.HistoryEntry.id == entry_id,
        models.HistoryEntry.user_email == user["email"],
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(entry)
    db.commit()
    return {"ok": True}


def _preview(data: dict) -> str:
    try:
        segments = data.get("transcript", {}).get("segments", [])
        if segments:
            text = segments[0].get("text", "")
            return text[:100] + "..." if len(text) > 100 else text
    except Exception:
        pass
    return ""

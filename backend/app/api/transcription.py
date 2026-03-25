import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.config import get_settings
from app.db.database import get_db
from app.db import models
from app.services import assemblyai

settings = get_settings()
router = APIRouter()


@router.get("/key")
async def get_assemblyai_key(user: dict = Depends(get_current_user)):
    """
    Return the server-managed AssemblyAI API key to authenticated clients.
    The browser uploads audio directly to AssemblyAI using this key,
    bypassing the server for large file transfers (avoids gateway timeout).
    """
    if not settings.assemblyai_api_key:
        raise HTTPException(status_code=500, detail="AssemblyAI API key not configured")
    return {"key": settings.assemblyai_api_key}


@router.post("/upload")
async def upload_audio(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """
    Proxy audio upload to AssemblyAI server-side.
    Avoids CORS issues with browser-direct uploads using Authorization headers.
    """
    if not settings.assemblyai_api_key:
        raise HTTPException(status_code=500, detail="AssemblyAI API key not configured")

    content = await file.read()
    async with httpx.AsyncClient(timeout=300) as client:
        resp = await client.post(
            "https://api.assemblyai.com/v2/upload",
            headers={
                "Authorization": settings.assemblyai_api_key,
                "Content-Type": "application/octet-stream",
            },
            content=content,
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"AssemblyAI upload failed: {resp.text}")
    return {"upload_url": resp.json()["upload_url"]}



class TranscriptionOptions(BaseModel):
    max_speakers: int | None = None
    boost_words: list[str] = []
    include_summary: bool = False
    detect_topics: bool = False
    analyze_sentiment: bool = False
    extract_key_phrases: bool = False
    speaker_label_mode: str = "generic"
    speaker_values: list[str] = []


class SubmitRequest(BaseModel):
    audio_url: str
    filename: str
    options: TranscriptionOptions


@router.post("/submit")
async def submit_transcription(
    body: SubmitRequest,
    user: dict = Depends(get_current_user),
):
    """Submit a transcription job to AssemblyAI. Returns the transcript ID."""
    transcript_id = await assemblyai.submit_transcription(
        audio_url=body.audio_url,
        options=body.options.model_dump(),
    )
    return {"id": transcript_id, "status": "queued"}


@router.get("/{transcript_id}")
async def poll_transcription(
    transcript_id: str,
    user: dict = Depends(get_current_user),
):
    """
    Poll AssemblyAI for transcription status.
    Returns the full response (status, utterances, summary, etc.).
    Frontend polls this every 3s until status == 'completed'.
    """
    try:
        result = await assemblyai.poll_transcription(transcript_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

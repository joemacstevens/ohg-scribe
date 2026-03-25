import asyncio
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.db.database import get_db
from app.db import models
from app.services import anthropic as claude
from app.services import assemblyai

router = APIRouter()


# ── Request/Response Models ──────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    system_prompt: str
    user_prompt: str
    model: str = "claude-sonnet-4-20250514"
    max_tokens: int = 16000


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    system_prompt: str
    messages: list[ChatMessage]
    model: str = "claude-sonnet-4-20250514"
    max_tokens: int = 4000


class RefineRequest(BaseModel):
    text: str
    instruction: str


class IdentifySpeakersRequest(BaseModel):
    transcript_id: str
    context: str
    final_model: str = "anthropic/claude-3-5-sonnet"


# ── Background Task Worker ───────────────────────────────────────────────────

def _run_generate_job(job_id: str, req: GenerateRequest, db_url: str):
    """Sync wrapper for the background generate task (runs in thread pool)."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    session = Session()

    job = session.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        return

    try:
        job.status = "running"
        session.commit()

        # Run async generate in a new event loop for this thread
        result_text = asyncio.run(claude.generate(
            system_prompt=req.system_prompt,
            user_prompt=req.user_prompt,
            model=req.model,
            max_tokens=req.max_tokens,
        ))

        job.status = "completed"
        job.result = {"text": result_text}
        session.commit()
    except Exception as e:
        job.status = "error"
        job.error = str(e)
        session.commit()
    finally:
        session.close()


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/generate")
async def generate_minutes(
    body: GenerateRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Start a background Claude generation job (e.g. generate meeting minutes).
    Returns a job ID immediately — client polls GET /api/jobs/{id} for result.
    This pattern avoids the Cloudmersive gateway timeout for long AI calls.
    """
    from app.config import get_settings
    settings = get_settings()

    job = models.Job(
        user_email=user["email"],
        type="generate_minutes",
        status="pending",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(_run_generate_job, job.id, body, settings.database_url)
    return {"jobId": job.id, "status": "pending"}


@router.post("/chat")
async def chat(
    body: ChatRequest,
    user: dict = Depends(get_current_user),
):
    """Multi-turn chat with Claude (Ask the Transcript). Direct call — usually fast."""
    try:
        text = await claude.chat(
            system_prompt=body.system_prompt,
            messages=[m.model_dump() for m in body.messages],
            model=body.model,
            max_tokens=body.max_tokens,
        )
        return {"text": text}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/refine")
async def refine(
    body: RefineRequest,
    user: dict = Depends(get_current_user),
):
    """Refine a text passage inline (Claude Haiku — fast). Direct call."""
    try:
        text = await claude.refine(text=body.text, instruction=body.instruction)
        return {"text": text}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/identify-speakers")
async def identify_speakers(
    body: IdentifySpeakersRequest,
    user: dict = Depends(get_current_user),
):
    """Use AssemblyAI LeMUR to identify speakers in a transcript."""
    try:
        result = await assemblyai.identify_speakers(
            transcript_id=body.transcript_id,
            context=body.context,
            final_model=body.final_model,
        )
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

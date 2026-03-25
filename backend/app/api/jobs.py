from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.db.database import get_db
from app.db import models

router = APIRouter()


@router.get("/{job_id}")
def get_job(
    job_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Poll a background job by ID.
    Returns: { id, status, result, error }
    Status values: pending | running | completed | error
    """
    job = db.query(models.Job).filter(
        models.Job.id == job_id,
        models.Job.user_email == user["email"],
    ).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "id": job.id,
        "type": job.type,
        "status": job.status,
        "result": job.result,
        "error": job.error,
        "createdAt": job.created_at.isoformat() if job.created_at else None,
    }

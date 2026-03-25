import os
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.orm import Session
from typing import Optional

from app.config import get_settings
from app.db.database import engine
from app.db import models

settings = get_settings()

BASE_PATH = settings.public_base_path.rstrip("/")
if BASE_PATH == "/":
    BASE_PATH = ""
if BASE_PATH and not BASE_PATH.startswith("/"):
    BASE_PATH = f"/{BASE_PATH}"

API_PREFIX = f"{BASE_PATH}/api" if BASE_PATH else "/api"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables if they don't exist (Alembic handles migrations in prod)
    models.Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="OHG Scribe API", lifespan=lifespan)

# ----- Auth -----

def get_current_user(
    x_ms_client_principal_name: Optional[str] = Header(None),
    db: Session = Depends(lambda: next(__import__('app.db.database', fromlist=['get_db']).get_db()))
):
    """Extract authenticated user from Entra ID headers. Auto-provisions on first login."""
    from app.db.database import get_db
    from app.db import models as m

    email = settings.dev_user_email or x_ms_client_principal_name
    if not email:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Auto-provision user row
    db_session = next(get_db())
    user = db_session.query(m.User).filter(m.User.email == email).first()
    if not user:
        user = m.User(email=email)
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

    return {"email": email}


# ----- Routers -----

from app.api import transcription, ai, jobs, history, presets, vocabularies

app.include_router(transcription.router, prefix=f"{API_PREFIX}/transcription", tags=["transcription"])
app.include_router(ai.router, prefix=f"{API_PREFIX}/ai", tags=["ai"])
app.include_router(jobs.router, prefix=f"{API_PREFIX}/jobs", tags=["jobs"])
app.include_router(history.router, prefix=f"{API_PREFIX}/history", tags=["history"])
app.include_router(presets.router, prefix=f"{API_PREFIX}/presets", tags=["presets"])
app.include_router(vocabularies.router, prefix=f"{API_PREFIX}/vocabularies", tags=["vocabularies"])


@app.get(f"{API_PREFIX}/health")
def health_check():
    return {"status": "ok", "service": "ohg-scribe"}


@app.get(f"{API_PREFIX}/auth/me")
def get_me(user: dict = Depends(get_current_user)):
    return user


# ----- SPA Static File Fallback -----

STATIC_DIR = settings.static_dir

if STATIC_DIR and os.path.isdir(STATIC_DIR):
    static_path = Path(STATIC_DIR)

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        normalized = full_path.lstrip("/")
        api_prefix_stripped = API_PREFIX.lstrip("/")

        if (normalized.startswith(api_prefix_stripped)
                or normalized.startswith("api/")
                or normalized == "health"):
            raise HTTPException(status_code=404, detail="Not Found")

        base_prefix = BASE_PATH.lstrip("/")
        lookup_path = normalized
        if base_prefix and (lookup_path == base_prefix or lookup_path.startswith(f"{base_prefix}/")):
            lookup_path = lookup_path[len(base_prefix):].lstrip("/")

        candidate = static_path / lookup_path
        if candidate.is_file():
            return FileResponse(candidate)

        dir_index = candidate / "index.html"
        if candidate.is_dir() and dir_index.is_file():
            if not full_path.endswith("/"):
                return RedirectResponse(url=f"/{full_path}/", status_code=301)
            return FileResponse(dir_index)

        return FileResponse(static_path / "index.html")

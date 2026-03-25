from fastapi import Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional

from app.config import get_settings
from app.db.database import get_db
from app.db import models

settings = get_settings()


def get_current_user(
    x_ms_client_principal_name: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> dict:
    """
    Extract authenticated user from Entra ID header.
    Falls back to DEV_USER_EMAIL for local development.
    Auto-provisions a User row on first login.
    """
    email = settings.dev_user_email or x_ms_client_principal_name
    if not email:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        user = models.User(email=email)
        db.add(user)
        db.commit()
        db.refresh(user)

    return {"email": email, "name": user.name}

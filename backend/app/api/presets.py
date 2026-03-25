from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.db.database import get_db
from app.db import models

router = APIRouter()


class SavePresetRequest(BaseModel):
    name: str
    options: dict


@router.get("")
def list_presets(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    presets = (
        db.query(models.Preset)
        .filter(models.Preset.user_email == user["email"])
        .order_by(models.Preset.created_at)
        .all()
    )
    return [{"id": p.id, "name": p.name, "options": p.options} for p in presets]


@router.post("")
def save_preset(
    body: SavePresetRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    preset = models.Preset(
        user_email=user["email"],
        name=body.name,
        options=body.options,
    )
    db.add(preset)
    db.commit()
    db.refresh(preset)
    return {"id": preset.id, "name": preset.name, "options": preset.options}


@router.delete("/{preset_id}")
def delete_preset(
    preset_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    preset = db.query(models.Preset).filter(
        models.Preset.id == preset_id,
        models.Preset.user_email == user["email"],
    ).first()
    if not preset:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(preset)
    db.commit()
    return {"ok": True}

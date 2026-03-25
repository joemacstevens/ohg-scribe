import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Boolean, DateTime, Text, ForeignKey, Integer
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.database import Base


def generate_uuid():
    return str(uuid.uuid4())


def now_utc():
    return datetime.utcnow()


class User(Base):
    __tablename__ = "users"

    email = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=True)
    created_at = Column(DateTime, default=now_utc)

    history_entries = relationship("HistoryEntry", back_populates="user", cascade="all, delete-orphan")
    presets = relationship("Preset", back_populates="user", cascade="all, delete-orphan")
    vocabularies = relationship("Vocabulary", back_populates="user", cascade="all, delete-orphan")
    jobs = relationship("Job", back_populates="user", cascade="all, delete-orphan")


class HistoryEntry(Base):
    __tablename__ = "history_entries"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    user_email = Column(String, ForeignKey("users.email"), nullable=False, index=True)
    filename = Column(String, nullable=False)
    transcribed_at = Column(DateTime, default=now_utc, index=True)
    speaker_count = Column(Integer, nullable=True)
    word_count = Column(Integer, nullable=True)
    # Full transcript data stored as JSONB for flexibility
    data = Column(JSONB, nullable=False, default=dict)

    user = relationship("User", back_populates="history_entries")


class Preset(Base):
    __tablename__ = "presets"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    user_email = Column(String, ForeignKey("users.email"), nullable=False, index=True)
    name = Column(String, nullable=False)
    # Full preset options object stored as JSONB
    options = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime, default=now_utc)

    user = relationship("User", back_populates="presets")


class VocabularyCategory(Base):
    __tablename__ = "vocabulary_categories"

    id = Column(String, primary_key=True)  # slug, e.g. "cardiology"
    name = Column(String, nullable=False)
    is_system = Column(Boolean, default=False, nullable=False)
    # null for system categories; user email for user-created categories
    user_email = Column(String, ForeignKey("users.email"), nullable=True, index=True)

    vocabularies = relationship("Vocabulary", back_populates="category", cascade="all, delete-orphan")


class Vocabulary(Base):
    __tablename__ = "vocabularies"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    category_id = Column(String, ForeignKey("vocabulary_categories.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    terms = Column(JSONB, nullable=False, default=list)  # array of strings
    is_system = Column(Boolean, default=False, nullable=False)
    # null for system vocabularies; user email for user-created vocabularies
    user_email = Column(String, ForeignKey("users.email"), nullable=True, index=True)
    created_at = Column(DateTime, default=now_utc)
    updated_at = Column(DateTime, default=now_utc, onupdate=now_utc)

    category = relationship("VocabularyCategory", back_populates="vocabularies")
    user = relationship("User", back_populates="vocabularies")


class Job(Base):
    """Background job tracking for long-running AI operations (e.g. generate minutes)."""
    __tablename__ = "jobs"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    user_email = Column(String, ForeignKey("users.email"), nullable=False, index=True)
    type = Column(String, nullable=False)  # e.g. "generate_minutes", "identify_speakers"
    status = Column(String, nullable=False, default="pending")  # pending | running | completed | error
    result = Column(JSONB, nullable=True)   # result data when completed
    error = Column(Text, nullable=True)     # error message when failed
    created_at = Column(DateTime, default=now_utc, index=True)
    updated_at = Column(DateTime, default=now_utc, onupdate=now_utc)

    user = relationship("User", back_populates="jobs")

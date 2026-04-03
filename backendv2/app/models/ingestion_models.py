"""
Ingestion data models and schemas.
"""

from pydantic import BaseModel
from typing import Optional


class IngestionRequest(BaseModel):
    """Request model for file ingestion."""
    title: Optional[str] = None
    org_id: Optional[str] = None
    group_id: Optional[str] = None


class IngestionResponse(BaseModel):
    """Response after successful ingestion."""
    lecture_id: str
    status: str
    input_type: str
    message: str


class IngestionStatusResponse(BaseModel):
    """Current ingestion/processing status."""
    lecture_id: str
    status: str
    stage: str  # "ingestion" | "transcription" | "rag" | "analysis"
    progress_percent: int

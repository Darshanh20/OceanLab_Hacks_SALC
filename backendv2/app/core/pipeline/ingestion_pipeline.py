"""
Main ingestion pipeline.

Flow:
INPUT → INGEST → NORMALIZE → STORE → TRIGGER DOWNSTREAM
"""

import asyncio
from typing import Optional, Dict, Any
from app.services.ingestion.audio_ingestor import ingest_audio
from app.services.ingestion.document_ingestor import ingest_document
from app.services.ingestion.transcript_ingestor import ingest_transcript
from app.services.processing.normalization_service import normalize_ingested_data
from app.services.db.lecture_repo import create_lecture, update_lecture_status
from app.services.supabase_client import get_supabase
from app.config import UPLOAD_BUCKET
import uuid


def detect_input_type(filename: str, content_type: str) -> str:
    """
    Detect input type from filename and MIME type.
    
    Returns: "audio" | "video" | "document" | "transcript"
    """
    audio_exts = [".mp3", ".wav", ".flac", ".aac", ".m4a", ".ogg"]
    video_exts = [".mp4", ".mov", ".avi", ".mkv", ".webm"]
    doc_exts = [".pdf", ".docx", ".pptx", ".xlsx", ".txt"]
    
    filename_lower = filename.lower()
    
    # Check by extension
    if any(filename_lower.endswith(ext) for ext in audio_exts):
        return "audio"
    if any(filename_lower.endswith(ext) for ext in video_exts):
        return "video"
    if any(filename_lower.endswith(ext) for ext in doc_exts):
        return "document"
    if filename_lower.endswith(".json"):
        return "transcript"
    
    # Check by MIME type
    if "audio" in content_type:
        return "audio"
    if "video" in content_type:
        return "video"
    if "document" in content_type or "pdf" in content_type:
        return "document"
    
    # Default to document
    return "document"


def get_ingestor(input_type: str):
    """Get the appropriate ingestor for the input type."""
    ingestors = {
        "audio": ingest_audio,
        "video": ingest_audio,  # Video uses audio ingestor (transcribe then)
        "document": ingest_document,
        "transcript": ingest_transcript,
    }
    return ingestors.get(input_type, ingest_document)


async def run_ingestion_pipeline(
    file_content: bytes,
    filename: str,
    content_type: str,
    user_id: str,
    org_id: Optional[str] = None,
    group_id: Optional[str] = None,
    title: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Main ingestion pipeline.
    
    Args:
        file_content: Raw file bytes
        filename: Original filename
        content_type: MIME type
        user_id: Uploader user ID
        org_id: Optional organization ID
        group_id: Optional team ID
        title: Optional custom title
    
    Returns:
        {
            "lecture_id": str,
            "status": "created",
            "message": str
        }
    """
    try:
        # Step 1: Detect input type
        input_type = detect_input_type(filename, content_type)
        
        # Step 2: Ingest (upload + extract if needed)
        ingestor = get_ingestor(input_type)
        ingested_data = await ingestor(file_content, filename)
        
        # Step 3: Normalize to unified format
        normalized = normalize_ingested_data(
            ingested_data,
            input_type=input_type,
            filename=filename
        )
        
        # Step 4: Create lecture record
        lecture_data = {
            "user_id": user_id,
            "title": title or filename.split(".")[0],
            "audio_url": ingested_data.get("audio_url"),
            "transcript_text": normalized.get("text"),
            "transcript_json": normalized.get("transcript_json"),
            "status": "uploading" if input_type in ["audio", "video"] else "transcribing",
            "org_id": org_id,
            "group_id": group_id,
        }
        
        lecture = create_lecture(lecture_data)
        lecture_id = lecture["id"]
        
        # Step 5: Trigger downstream pipelines asynchronously
        asyncio.create_task(_trigger_downstream_pipelines(lecture_id, input_type))
        
        return {
            "lecture_id": lecture_id,
            "status": "created",
            "input_type": input_type,
            "message": f"File uploaded successfully. {input_type.capitalize()} will be processed."
        }
    
    except Exception as e:
        raise Exception(f"Ingestion pipeline failed: {str(e)}")


async def _trigger_downstream_pipelines(lecture_id: str, input_type: str):
    """Trigger transcription, RAG, and analysis pipelines asynchronously."""
    from .transcription_pipeline import run_transcription_pipeline
    from .rag_pipeline import run_rag_pipeline
    from .analysis_pipeline import run_analysis_pipeline
    
    try:
        # If audio/video, transcribe first
        if input_type in ["audio", "video"]:
            await run_transcription_pipeline(lecture_id)
        
        # Always run RAG and analysis
        await run_rag_pipeline(lecture_id)
        await run_analysis_pipeline(lecture_id)
        
    except Exception as e:
        # Log error but don't fail the entire pipeline
        print(f"Downstream pipeline error for lecture {lecture_id}: {str(e)}")
        update_lecture_status(lecture_id, "failed")

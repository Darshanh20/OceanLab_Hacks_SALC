"""
Ingestion API router.

Handles file uploads and ingestion pipeline orchestration.
"""

from fastapi import APIRouter, File, UploadFile, Depends, Form, HTTPException, status
from app.models.ingestion_models import IngestionRequest, IngestionResponse
from app.middleware.auth_middleware import get_current_user
from app.core.pipeline.ingestion_pipeline import run_ingestion_pipeline
from app.services.db.lecture_repo import get_lecture

router = APIRouter(prefix="/api/ingestion", tags=["ingestion"])


@router.post("/upload", response_model=IngestionResponse)
async def upload_file(
    file: UploadFile = File(...),
    title: str = Form(None),
    org_id: str = Form(None),
    group_id: str = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload and ingest a file.
    
    Supports:
    - Audio: MP3, WAV, FLAC, AAC, M4A, OGG
    - Video: MP4, MOV, AVI, MKV, WEBM
    - Documents: PDF, DOCX, PPTX, XLSX, TXT
    - Transcripts: JSON (structured), TXT (plain)
    
    The file will be processed asynchronously through:
    1. Ingestion (upload/extract)
    2. Transcription (if audio/video)
    3. RAG (embeddings)
    4. Analysis (summaries, keywords, etc.)
    """
    try:
        # Read file content
        file_content = await file.read()
        
        # Run ingestion pipeline
        result = await run_ingestion_pipeline(
            file_content=file_content,
            filename=file.filename,
            content_type=file.content_type,
            user_id=current_user["user_id"],
            org_id=org_id,
            group_id=group_id,
            title=title
        )
        
        return IngestionResponse(
            lecture_id=result["lecture_id"],
            status=result["status"],
            input_type=result["input_type"],
            message=result["message"]
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ingestion failed: {str(e)}"
        )


@router.get("/status/{lecture_id}")
async def get_ingestion_status(
    lecture_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get current processing status of a lecture."""
    try:
        lecture = get_lecture(lecture_id)
        
        if not lecture:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lecture not found"
            )
        
        # Map status to stage
        status_to_stage = {
            "uploading": "ingestion",
            "transcribing": "transcription",
            "summarizing": "analysis",
            "processing_rag": "rag",
            "completed": "completed",
            "failed": "failed"
        }
        
        stage = status_to_stage.get(lecture["status"], "unknown")
        
        # Estimate progress
        progress_map = {
            "ingestion": 10,
            "transcription": 30,
            "rag": 60,
            "analysis": 90,
            "completed": 100,
            "failed": 0
        }
        
        progress = progress_map.get(stage, 0)
        
        return {
            "lecture_id": lecture_id,
            "status": lecture["status"],
            "stage": stage,
            "progress_percent": progress,
            "title": lecture["title"]
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Status check failed: {str(e)}"
        )

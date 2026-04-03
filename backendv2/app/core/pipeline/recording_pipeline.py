"""
Recording pipeline.

Handles browser-recorded audio/video processing.
Uses same pipeline as uploaded audio files.
"""

from typing import Optional
from app.core.pipeline.ingestion_pipeline import run_ingestion_pipeline


async def run_recording_pipeline(
    recording_blob: bytes,
    filename: str,
    content_type: str,
    user_id: str,
    title: Optional[str] = None,
    org_id: Optional[str] = None,
    group_id: Optional[str] = None
) -> dict:
    """
    Process browser-recorded audio/video.
    
    Called from frontend when user stops recording.
    Recording format is typically WebM (audio/webm or video/webm).
    
    Args:
        recording_blob: Raw recording bytes from browser
        filename: Generated filename (e.g., "recording_2024_01_01_10_00_00.webm")
        content_type: MIME type from browser (audio/webm or video/webm)
        user_id: User who recorded
        title: Optional custom title
        org_id: Optional organization
        group_id: Optional team
    
    Returns:
        {
            "lecture_id": str,
            "status": "created",
            "input_type": "audio" or "video",
            "message": str
        }
    """
    try:
        # Route to main ingestion pipeline
        # Recording is treated as audio/video upload
        result = await run_ingestion_pipeline(
            file_content=recording_blob,
            filename=filename,
            content_type=content_type,
            user_id=user_id,
            org_id=org_id,
            group_id=group_id,
            title=title or f"Recording - {filename}"
        )
        
        return {
            "lecture_id": result["lecture_id"],
            "status": result["status"],
            "input_type": result["input_type"],
            "message": f"Recording uploaded and processing started. {result['message']}"
        }
    
    except Exception as e:
        raise Exception(f"Recording pipeline failed: {str(e)}")

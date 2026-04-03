"""
Live meeting streaming pipeline.

Real-time orchestration for streaming meeting audio and processing incrementally.
Coordinates with WebSocket endpoint to receive chunks, transcribe, and store.
"""

import asyncio
from typing import Optional, Callable
from app.services.ingestion.live_meeting_ingestor import LiveMeetingIngestor
from app.services.processing.streaming_service import stream_transcription_to_deepgram
from app.services.db.lecture_repo import update_lecture_status


async def run_live_meeting_pipeline(
    meeting_id: str,
    user_id: str,
    title: str,
    platform: str = "generic",
    org_id: Optional[str] = None
) -> dict:
    """
    Initialize live meeting for streaming ingestion.
    
    Args:
        meeting_id: Unique meeting identifier
        user_id: User uploading the meeting
        title: Meeting title
        platform: "zoom" | "meet" | "teams" | "webex"
        org_id: Optional organization ID
    
    Returns:
        {
            "lecture_id": str,
            "meeting_id": str,
            "status": "streaming",
            "platform": str
        }
    """
    try:
        ingestor = LiveMeetingIngestor(meeting_id, user_id, org_id)
        lecture_id = await ingestor.initialize_meeting(title, platform)
        
        # Store ingestor in session/cache for WebSocket to use
        # In production, use Redis or in-memory store like:
        # ACTIVE_MEETINGS[meeting_id] = ingestor
        
        return {
            "lecture_id": lecture_id,
            "meeting_id": meeting_id,
            "status": "streaming",
            "platform": platform
        }
    
    except Exception as e:
        raise Exception(f"Live meeting pipeline failed: {str(e)}")


async def process_live_chunk(
    meeting_id: str,
    audio_chunk: bytes,
    chunk_index: int,
    segment_callback: Optional[Callable] = None
) -> dict:
    """
    Process single audio chunk from live meeting.
    
    Args:
        meeting_id: Which meeting this chunk belongs to
        audio_chunk: Raw audio bytes
        chunk_index: Sequential chunk number
        segment_callback: Optional callback for completed segments
    
    Returns:
        Processing status
    """
    try:
        # Get the ingestor from active meetings store
        # In production:
        # ingestor = ACTIVE_MEETINGS.get(meeting_id)
        # For now, placeholder:
        
        # Transcribe chunk via Deepgram streaming
        result = await stream_transcription_to_deepgram(
            audio_chunk,
            on_transcript_segment=segment_callback
        )
        
        return {
            "chunk_index": chunk_index,
            "status": "processed",
            "segment": result.get("segment")
        }
    
    except Exception as e:
        return {
            "chunk_index": chunk_index,
            "status": "error",
            "error": str(e)
        }


async def finalize_live_meeting(meeting_id: str) -> dict:
    """
    Finalize live meeting and trigger analysis pipelines.
    
    Called when meeting ends (extension sends finalize signal).
    
    Args:
        meeting_id: Meeting to finalize
    
    Returns:
        Finalized lecture record
    """
    try:
        # Get ingestor from active meetings
        # ingestor = ACTIVE_MEETINGS.pop(meeting_id)
        # await ingestor.finalize_meeting()
        
        # Trigger downstream pipelines
        # from .rag_pipeline import run_rag_pipeline
        # from .analysis_pipeline import run_analysis_pipeline
        # asyncio.create_task(run_rag_pipeline(lecture_id))
        # asyncio.create_task(run_analysis_pipeline(lecture_id))
        
        return {
            "meeting_id": meeting_id,
            "status": "finalized",
            "message": "Meeting processing initiated"
        }
    
    except Exception as e:
        raise Exception(f"Failed to finalize meeting: {str(e)}")

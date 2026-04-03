"""
Live meeting ingestion service.

Handles real-time audio streaming from browser extensions and meeting apps.
Integrates with WebSocket for chunk-based streaming and stores incrementally.
"""

import asyncio
import json
from typing import Optional, Dict, Any
from datetime import datetime
from app.services.supabase_client import get_supabase


class LiveMeetingIngestor:
    """Manages live meeting ingestion with streaming transcription."""
    
    def __init__(self, meeting_id: str, user_id: str, org_id: Optional[str] = None):
        self.meeting_id = meeting_id
        self.user_id = user_id
        self.org_id = org_id
        self.transcript_segments = []
        self.lecture_id = None
        self.total_duration = 0
    
    async def initialize_meeting(self, title: str, meeting_platform: str) -> str:
        """
        Create initial lecture record for live meeting.
        
        Args:
            title: Meeting title
            meeting_platform: "zoom" | "meet" | "teams" | "webex"
        
        Returns:
            lecture_id for streaming chunks
        """
        supabase = get_supabase()
        
        lecture_data = {
            "user_id": self.user_id,
            "title": title,
            "status": "transcribing",  # Live meeting starts in transcribing state
            "org_id": self.org_id,
            "transcript_json": json.dumps({
                "platform": meeting_platform,
                "segments": [],
                "duration_seconds": 0,
                "word_count": 0,
                "language": "en",
                "source_type": "live_meeting",
                "started_at": datetime.utcnow().isoformat(),
                "is_live": True
            })
        }
        
        response = supabase.table("lectures").insert(lecture_data).execute()
        
        if response.data:
            self.lecture_id = response.data[0]["id"]
            return self.lecture_id
        
        raise Exception("Failed to initialize live meeting")
    
    async def ingest_audio_chunk(
        self,
        audio_chunk: bytes,
        chunk_index: int,
        timestamp_ms: int = 0
    ) -> Dict[str, Any]:
        """
        Ingest audio chunk from live stream.
        
        This tracks the chunk but doesn't transcribe directly.
        Transcription happens in streaming_transcription_pipeline.
        
        Args:
            audio_chunk: Raw audio bytes (WebM, WAV, etc.)
            chunk_index: Sequential chunk number
            timestamp_ms: Start time in milliseconds
        
        Returns:
            {
                "chunk_index": int,
                "timestamp_ms": int,
                "size_bytes": int,
                "status": "received"
            }
        """
        if not self.lecture_id:
            raise Exception("Meeting not initialized. Call initialize_meeting() first.")
        
        return {
            "chunk_index": chunk_index,
            "timestamp_ms": timestamp_ms,
            "size_bytes": len(audio_chunk),
            "status": "received"
        }
    
    async def update_transcript_segment(
        self,
        segment_index: int,
        speaker: Optional[str],
        text: str,
        start_ms: int,
        end_ms: int,
        confidence: float = 0.95
    ) -> Dict[str, Any]:
        """
        Update live transcript with new segment.
        
        Called by streaming_transcription_pipeline as segments arrive from Deepgram.
        
        Args:
            segment_index: Position in segments array
            speaker: Speaker name or "Speaker N"
            text: Transcribed text
            start_ms: Start time in milliseconds
            end_ms: End time in milliseconds
            confidence: Deepgram confidence score
        
        Returns:
            Updated segment record
        """
        supabase = get_supabase()
        
        # Add to in-memory list
        segment = {
            "index": segment_index,
            "speaker": speaker or "Speaker 1",
            "text": text,
            "start": start_ms,
            "end": end_ms,
            "confidence": confidence
        }
        self.transcript_segments.append(segment)
        
        # Update lecture record with latest segments
        transcript_json = {
            "platform": "live",
            "segments": self.transcript_segments,
            "duration_seconds": (end_ms // 1000),
            "word_count": len(text.split()),
            "language": "en",
            "source_type": "live_meeting",
            "is_live": True,
            "last_updated": datetime.utcnow().isoformat()
        }
        
        response = supabase.table("lectures").update({
            "transcript_json": transcript_json
        }).eq("id", self.lecture_id).execute()
        
        return segment
    
    async def finalize_meeting(self) -> Dict[str, Any]:
        """
        Finalize live meeting transcription.
        
        Called when meeting ends. Triggers downstream RAG + analysis pipelines.
        
        Returns:
            Final lecture record
        """
        supabase = get_supabase()
        
        # Update status to trigger analysis
        response = supabase.table("lectures").update({
            "status": "summarizing"
        }).eq("id", self.lecture_id).execute()
        
        return response.data[0] if response.data else {}


async def ingest_live_meeting(
    audio_chunk: bytes,
    meeting_id: str,
    chunk_index: int,
    platform: str = "generic"
) -> dict:
    """
    Helper function for simple live meeting chunk ingestion.
    
    Used by WebSocket endpoint to quickly process chunks.
    
    Args:
        audio_chunk: Raw audio bytes
        meeting_id: Unique meeting identifier
        chunk_index: Sequential chunk number
        platform: Meeting platform ("zoom", "meet", "teams", etc.)
    
    Returns:
        Ingestion status
    """
    # In production, you'd maintain a pool of LiveMeetingIngestor instances
    # keyed by meeting_id. For now, this is a placeholder.
    
    return {
        "meeting_id": meeting_id,
        "chunk_index": chunk_index,
        "status": "received",
        "bytes": len(audio_chunk)
    }

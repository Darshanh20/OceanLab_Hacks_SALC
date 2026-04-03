"""
WebSocket endpoint for live meeting streaming.

Enables real-time audio chunk streaming from browser extensions for live Zoom/Meet/Teams meetings.
Handles incremental transcription and storage.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, File, UploadFile
from app.middleware.auth_middleware import get_current_user
from app.core.pipeline.live_meeting_pipeline import (
    run_live_meeting_pipeline,
    process_live_chunk,
    finalize_live_meeting
)
import asyncio
import json
from typing import Dict

router = APIRouter(prefix="/api/ingestion/live", tags=["live-meetings"])

# In-memory store of active WebSocket connections per meeting
# In production, use Redis for distributed system
ACTIVE_CONNECTIONS: Dict[str, WebSocket] = {}


@router.websocket("/ws/{meeting_id}")
async def websocket_live_meeting(
    websocket: WebSocket,
    meeting_id: str,
    token: str = Query(...)
):
    """
    WebSocket endpoint for live meeting streaming.
    
    Flow:
    1. Browser extension connects with jwt token
    2. Sends audio chunks every N seconds
    3. Server transcribes incrementally
    4. Client receives transcript updates
    5. On meeting end, triggers analysis
    
    Message formats:
    
    Client → Server:
    {
        "type": "init",
        "title": "Meeting Title",
        "platform": "zoom|meet|teams|webex",
        "org_id": "optional"
    }
    
    {
        "type": "chunk",
        "chunk_index": 1,
        "audio_chunk": "base64-encoded bytes",
        "timestamp_ms": 0
    }
    
    {
        "type": "finalize"
    }
    
    Server → Client:
    {
        "type": "chunk_ack",
        "chunk_index": 1,
        "status": "received|processing"
    }
    
    {
        "type": "transcript_segment",
        "segment_index": 1,
        "speaker": "Speaker 1",
        "text": "Transcribed text...",
        "start_ms": 0,
        "end_ms": 5000,
        "confidence": 0.95
    }
    
    {
        "type": "finalized",
        "lecture_id": "uuid",
        "message": "Meeting processing started"
    }
    """
    
    await websocket.accept()
    meeting_initialized = False
    lecture_id = None
    chunk_count = 0
    
    try:
        # Initial message must be init
        init_msg = await websocket.receive_json()
        
        if init_msg.get("type") != "init":
            await websocket.send_json({
                "type": "error",
                "error": "First message must be type 'init'"
            })
            await websocket.close()
            return
        
        # Initialize meeting
        title = init_msg.get("title", f"Live Meeting {meeting_id}")
        platform = init_msg.get("platform", "generic")
        org_id = init_msg.get("org_id")
        user_id = "temp_user"  # Would come from token in production
        
        result = await run_live_meeting_pipeline(
            meeting_id=meeting_id,
            user_id=user_id,
            title=title,
            platform=platform,
            org_id=org_id
        )
        
        lecture_id = result["lecture_id"]
        meeting_initialized = True
        
        await websocket.send_json({
            "type": "initialized",
            "lecture_id": lecture_id,
            "meeting_id": meeting_id
        })
        
        # Handle incoming chunks
        ACTIVE_CONNECTIONS[meeting_id] = websocket
        
        while True:
            msg = await websocket.receive_json()
            msg_type = msg.get("type")
            
            if msg_type == "chunk":
                chunk_index = msg.get("chunk_index")
                timestamp_ms = msg.get("timestamp_ms", 0)
                
                # Process chunk (decoding would be needed for actual audio)
                result = await process_live_chunk(
                    meeting_id=meeting_id,
                    audio_chunk=b"",  # In production: base64.b64decode(msg.get("audio_chunk"))
                    chunk_index=chunk_index
                )
                
                # Acknowledge chunk receipt
                await websocket.send_json({
                    "type": "chunk_ack",
                    "chunk_index": chunk_index,
                    "status": "processed"
                })
                
                chunk_count += 1
            
            elif msg_type == "finalize":
                # End meeting, trigger analysis
                result = await finalize_live_meeting(meeting_id)
                
                await websocket.send_json({
                    "type": "finalized",
                    "lecture_id": lecture_id,
                    "message": result.get("message"),
                    "total_chunks": chunk_count
                })
                
                break
            
            elif msg_type == "ping":
                # Keep-alive response
                await websocket.send_json({"type": "pong"})
    
    except WebSocketDisconnect:
        # Client disconnected unexpectedly
        if meeting_id in ACTIVE_CONNECTIONS:
            del ACTIVE_CONNECTIONS[meeting_id]
    
    except Exception as e:
        await websocket.send_json({
            "type": "error",
            "error": str(e)
        })
        await websocket.close()
    
    finally:
        if meeting_id in ACTIVE_CONNECTIONS:
            del ACTIVE_CONNECTIONS[meeting_id]


@router.post("/recording")
async def upload_recording(
    file: UploadFile = File(...),
    title: str = None,
    org_id: str = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Upload browser-recorded audio/video.
    
    Called from frontend when recording is complete.
    Handles MediaRecorder Blob from browser.
    
    Request:
    - file: WebM or MP4 recording blob
    - title: Optional custom title
    - org_id: Optional organization ID
    
    Response:
    - lecture_id
    - status
    - processing message
    """
    from app.core.pipeline.recording_pipeline import run_recording_pipeline
    
    file_content = await file.read()
    
    result = await run_recording_pipeline(
        recording_blob=file_content,
        filename=file.filename,
        content_type=file.content_type,
        user_id=current_user["user_id"],
        title=title,
        org_id=org_id
    )
    
    return result

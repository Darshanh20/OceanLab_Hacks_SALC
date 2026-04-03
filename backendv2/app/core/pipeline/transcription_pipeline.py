"""
Transcription pipeline.

Converts audio/video to transcript using Deepgram.
"""

from app.services.db.lecture_repo import get_lecture, update_lecture
from app.services.transcription_service import transcribe_audio
from app.services.db.lecture_repo import update_lecture_status


async def run_transcription_pipeline(lecture_id: str) -> dict:
    """
    Transcribe audio/video lecture.
    
    Steps:
    1. Get lecture from DB
    2. Call Deepgram transcription API
    3. Store transcript + structured JSON
    4. Update status
    """
    try:
        # 1. Get lecture
        lecture = get_lecture(lecture_id)
        
        if not lecture or not lecture.get("audio_url"):
            raise ValueError("Lecture not found or missing audio_url")
        
        update_lecture_status(lecture_id, "transcribing")
        
        # 2. Transcribe via Deepgram
        transcript_result = await transcribe_audio(lecture["audio_url"])
        
        # 3. Update lecture with transcript
        update_data = {
            "transcript_text": transcript_result.get("transcript_text"),
            "transcript_json": transcript_result.get("transcript_json"),
            "status": "summarizing"
        }
        
        update_lecture(lecture_id, update_data)
        
        return {
            "lecture_id": lecture_id,
            "status": "transcribed",
            "word_count": transcript_result.get("word_count", 0)
        }
    
    except Exception as e:
        update_lecture_status(lecture_id, "failed")
        raise Exception(f"Transcription pipeline failed: {str(e)}")

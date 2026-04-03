"""
Audio ingestion service.

Handles audio/video file uploads.
"""

import uuid
from app.services.supabase_client import get_supabase
from app.config import UPLOAD_BUCKET


async def ingest_audio(file_content: bytes, filename: str) -> dict:
    """
    Upload audio/video file to storage.
    
    Returns:
        {
            "audio_url": str,
            "source_type": "audio",
            "filename": str,
            "size_bytes": int
        }
    """
    try:
        supabase = get_supabase()
        
        # Generate unique filename
        file_ext = filename.split(".")[-1]
        unique_filename = f"audio/{uuid.uuid4()}.{file_ext}"
        
        # Upload to Supabase Storage
        response = supabase.storage.from_bucket(UPLOAD_BUCKET).upload(
            unique_filename,
            file_content,
            file_options={
                "content-type": "audio/mpeg",  # or video/* depending on input
            }
        )
        
        # Get public URL
        public_url = supabase.storage.from_bucket(UPLOAD_BUCKET).get_public_url(unique_filename)
        
        return {
            "audio_url": public_url,
            "source_type": "audio",
            "filename": filename,
            "size_bytes": len(file_content),
            "storage_path": unique_filename
        }
    
    except Exception as e:
        raise Exception(f"Audio ingestion failed: {str(e)}")

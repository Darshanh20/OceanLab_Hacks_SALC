import os
import tempfile
import logging
import re
import uuid
from fastapi import APIRouter, BackgroundTasks, Form, HTTPException, Depends
from fastapi.responses import JSONResponse
from pathlib import Path
from typing import Optional

from app.middleware.auth_middleware import get_current_user
from app.models.schemas import LectureResponse
from app.services.supabase_client import get_supabase
from app.services.transcription_service import transcribe_audio_deepgram
from app.services.rag_service import process_lecture_for_rag
from app.utils.youtube import download_youtube_audio
from app.utils.drive import download_drive_file

# Set up logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

router = APIRouter()


def _sanitize_filename(filename: str) -> str:
    """
    Sanitize filename for Supabase storage compatibility.
    Removes/replaces special characters that cause storage errors.
    """
    # Remove or replace problematic characters
    # Keep only alphanumeric, hyphens, underscores, and dots
    sanitized = re.sub(r'[^\w\-\.\s]', '', filename)
    # Replace multiple spaces/underscores with single underscore
    sanitized = re.sub(r'[\s_]+', '_', sanitized)
    # Remove leading/trailing underscores
    sanitized = sanitized.strip('_')
    # Ensure filename is not empty
    return sanitized or "lecture"


def _validate_update_data(data: dict) -> dict:
    """
    Validate and filter update data to only allowed lecture columns.
    Prevents invalid column errors from crashing the entire pipeline.
    """
    allowed_keys = {
        "transcript_text",
        "summary_text",
        "status",
        "topics",
        "audio_url",
        "error_message"
    }
    validated = {k: v for k, v in data.items() if k in allowed_keys}
    if validated != data:
        removed_keys = set(data.keys()) - allowed_keys
        logger.warning(f"[DB] Filtered out invalid columns: {removed_keys}")
    return validated


def _safe_update_lecture(supabase, lecture_id: str, data: dict) -> bool:
    """
    Safely update lecture record with error handling.
    Returns True if successful, False otherwise.
    
    This is the preferred way to update lectures to ensure:
    - Only valid columns are updated
    - Errors don't crash the whole pipeline
    - Full logging of what went wrong
    """
    try:
        validated_data = _validate_update_data(data)
        if not validated_data:
            logger.warning(f"[DB] No valid fields to update for lecture {lecture_id}")
            return False
        
        logger.debug(f"[DB] Updating lecture {lecture_id} with: {list(validated_data.keys())}")
        supabase.table("lectures").update(validated_data).eq("id", lecture_id).execute()
        logger.info(f"[DB] Successfully updated lecture {lecture_id}")
        return True
    except Exception as e:
        logger.error(f"[DB ERROR] Failed to update lecture {lecture_id}: {str(e)}", exc_info=True)
        return False


def _fail_lecture(supabase, lecture_id: str, error: Exception) -> None:
    """
    Central failure handler - updates lecture status to failed with error message.
    This ensures all failures are properly tracked in the database.
    """
    try:
        error_msg = str(error)
        logger.error(f"[FAIL] Marking lecture {lecture_id} as failed: {error_msg}")
        
        _safe_update_lecture(supabase, lecture_id, {
            "status": "failed",
            "error_message": error_msg
        })
        logger.info(f"[FAIL] Lecture {lecture_id} marked as failed in database")
    except Exception as e:
        logger.critical(f"[CRITICAL] Failed to mark lecture {lecture_id} as failed: {str(e)}", exc_info=True)


def _can_write_lecture_scope() -> bool:
    """Check if user has permission to write lectures"""
    # This would typically check user role/org membership
    # For now, assume authenticated users can write
    return True


def _detect_link_type(url: str) -> str:
    """Auto-detect YouTube vs Google Drive"""
    if "youtube.com" in url or "youtu.be" in url:
        return "youtube"
    if "drive.google.com" in url:
        return "google_drive"
    return "unknown"


async def _upload_and_process_link(
    file_path: str,
    title: str,
    source: str,
    org_id: Optional[str],
    group_id: Optional[str],
    user_id: Optional[str],
    lecture_id: str,
) -> dict:
    """
    Background task: upload to storage and process (lecture record already created)
    
    Pipeline stages:
    1. Upload audio to Supabase storage
    2. Transcribe with Deepgram
    3. Process with RAG
    4. Mark complete
    """
    supabase = get_supabase()
    
    try:
        logger.info(f"[LINK] Starting upload and process for {source}: {title} (Lecture: {lecture_id})")
        
        # =====================================================================
        # STAGE 1: Upload to Storage
        # =====================================================================
        try:
            bucket_name = "lecture-audio"
            org_path = org_id or "default"
            group_path = group_id or "default"
            
            # Sanitize filename to remove special characters that cause storage errors
            original_filename = Path(file_path).name
            base_name = Path(original_filename).stem  # filename without extension
            extension = Path(original_filename).suffix  # .mp3, .wav, etc.
            
            # Add unique ID to prevent duplicate file conflicts in storage
            unique_id = str(uuid.uuid4())[:8]
            sanitized_name = f"{_sanitize_filename(base_name)}_{unique_id}{extension}"
            
            file_name = f"{org_path}/{group_path}/{sanitized_name}"
            
            logger.info(f"[UPLOAD] Uploading audio to storage: {file_name}")
            logger.info(f"[UPLOAD] Original filename: {original_filename}, Sanitized: {sanitized_name}")
            with open(file_path, "rb") as f:
                supabase.storage.from_(bucket_name).upload(file_name, f)
            
            # Get public URL
            audio_url = supabase.storage.from_(bucket_name).get_public_url(file_name)
            logger.info(f"[UPLOAD] Audio URL: {audio_url}")
            
            # Update lecture record with audio URL
            _safe_update_lecture(supabase, lecture_id, {
                "audio_url": audio_url,
                "status": "transcribing"
            })
            logger.info(f"[UPLOAD] Successfully uploaded for lecture {lecture_id}")
        
        except Exception as e:
            logger.error(f"[UPLOAD FAILED] Could not upload to storage: {str(e)}", exc_info=True)
            _fail_lecture(supabase, lecture_id, e)
            raise
        
        # =====================================================================
        # STAGE 2: Transcription with Deepgram
        # =====================================================================
        transcription_result = None
        try:
            logger.info(f"[TRANSCRIBE] Starting Deepgram transcription for {file_path}")
            transcription_result = await transcribe_audio_deepgram(file_path)
            transcript_text = transcription_result.get("transcript_text", "")
            transcript_length = len(transcript_text)
            logger.info(f"[TRANSCRIBE] Completed: {transcript_length} chars, topics: {len(transcription_result.get('topics', []))} items")
            print(f"[TRANSCRIPT DEBUG] Lecture {lecture_id} transcript length: {transcript_length}")
            print(f"[TRANSCRIPT DEBUG] Lecture {lecture_id} transcript:\n{transcript_text}")
            if not transcript_text.strip():
                logger.warning(f"[TRANSCRIPT DEBUG] Empty transcript for lecture {lecture_id}. Result keys: {list(transcription_result.keys())}")
            
            # Update with transcription data
            update_data = {
                "transcript_text": transcript_text,
                "summary_text": transcription_result.get("summary_text", ""),
                "status": "processing_rag",
            }

            logger.info(f"[TRANSCRIBE] Updating lecture {lecture_id} with transcription data")

            # Save core fields first so transcript is never blocked by optional columns.
            core_saved = _safe_update_lecture(supabase, lecture_id, update_data)
            if not core_saved:
                raise Exception("Failed to save transcript_text/summary_text to lectures table")

            # Save topics as best-effort (optional column in some environments).
            if "topics" in transcription_result and transcription_result["topics"]:
                topics_saved = _safe_update_lecture(supabase, lecture_id, {
                    "topics": transcription_result["topics"]
                })
                if not topics_saved:
                    logger.warning(
                        f"[TRANSCRIBE] Could not save topics for lecture {lecture_id}. "
                        "Run DB migration to add lectures.topics JSONB."
                    )

            logger.info(f"[TRANSCRIBE] Successfully saved transcription for lecture {lecture_id}")
        
        except Exception as e:
            logger.error(f"[TRANSCRIBE FAILED] Transcription error: {str(e)}", exc_info=True)
            _fail_lecture(supabase, lecture_id, e)
            raise
        
        # =====================================================================
        # STAGE 3: RAG Processing
        # =====================================================================
        if transcription_result:
            try:
                logger.info(f"[RAG] Starting RAG processing for lecture {lecture_id}")
                await process_lecture_for_rag(lecture_id, transcription_result.get("transcript_text", ""))
                logger.info(f"[RAG] RAG processing complete for lecture {lecture_id}")
            
            except Exception as e:
                logger.error(f"[RAG FAILED] RAG processing error: {str(e)}", exc_info=True)
                # RAG failure is non-critical - transcription is already saved
                logger.warning(f"[RAG] Continuing despite RAG failure - transcription is preserved")
        
        # =====================================================================
        # STAGE 4: Mark Completed
        # =====================================================================
        logger.info(f"[COMPLETE] Marking lecture {lecture_id} as completed")
        _safe_update_lecture(supabase, lecture_id, {
            "status": "completed"
        })
        
        logger.info(f"[COMPLETE] Lecture {lecture_id} processing complete!")
        return {"success": True, "lecture_id": lecture_id}
    
    except Exception as e:
        logger.error(f"[LINK] Fatal error in background task: {str(e)}", exc_info=True)
        # Already fails the lecture above
        raise
    
    finally:
        # Cleanup temp file
        try:
            if os.path.exists(file_path):
                os.unlink(file_path)
                logger.info(f"[CLEANUP] Cleaned up temp file: {file_path}")
        except Exception as cleanup_error:
            logger.warning(f"[CLEANUP] Failed to cleanup temp file: {str(cleanup_error)}")


@router.post("/process/link", response_model=LectureResponse)
async def process_link(
    url: str = Form(...),
    title: str = Form(default=""),
    org_id: str = Form(default=""),
    group_id: str = Form(default=""),
    background_tasks: BackgroundTasks = None,
    current_user: dict = Depends(get_current_user),
):
    """
    Process YouTube or Google Drive link
    - Detect link type
    - Download audio
    - Upload to storage
    - Transcribe with Deepgram
    """
    
    try:
        # Validate URL
        if not url or not url.strip():
            raise ValueError("URL cannot be empty")
        
        if not _can_write_lecture_scope():
            raise HTTPException(status_code=403, detail="Permission denied")
        
        link_type = _detect_link_type(url)
        if link_type == "unknown":
            raise ValueError("Invalid URL - must be YouTube (youtube.com, youtu.be) or Google Drive (drive.google.com) link")
        
        temp_dir = tempfile.mkdtemp()
        
        try:
            # Download audio based on link type
            if link_type == "youtube":
                download_result = await download_youtube_audio(url, temp_dir)
            else:  # google_drive
                download_result = await download_drive_file(url, temp_dir)
            
            file_path = download_result["file_path"]
            detected_title = download_result["title"]
            source = download_result["source"]
            
            # Use provided title or detected title
            final_title = title or detected_title
            # Create lecture record synchronously (so we have ID for polling)
            supabase = get_supabase()
            
            lecture_data = {
                "title": final_title,
                "user_id": current_user["user_id"],
                "org_id": org_id if org_id and org_id != "default" else None,
                "group_id": group_id if group_id and group_id != "default" else None,
                "status": "uploading",
            }
            
            logger.info(f"[LINK] Creating lecture record in database for {source}: {final_title}")
            response = supabase.table("lectures").insert(lecture_data).execute()
            print(response)
            if not response.data:
                raise Exception("Failed to create lecture record - no data returned")
            
            lecture_id = response.data[0]["id"]
            logger.info(f"[LINK] Lecture created with ID: {lecture_id}")
            
            # Queue background tasks
            if background_tasks:
                background_tasks.add_task(
                    _upload_and_process_link,
                    file_path=file_path,
                    title=final_title,
                    source=source,
                    org_id=org_id,
                    group_id=group_id,
                    user_id=current_user["user_id"],
                    lecture_id=lecture_id,
                )
            
            return LectureResponse(
                id=lecture_id,
                title=final_title,
                status="uploading",
                organization_id=org_id or "default",
                group_id=group_id or "default",
                source=source,
            )
        
        except ValueError as e:
            # Clean up temp dir on error
            import shutil
            try:
                shutil.rmtree(temp_dir)
            except:
                pass
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            # Clean up temp dir on error
            import shutil
            try:
                shutil.rmtree(temp_dir)
            except:
                pass
            raise HTTPException(status_code=500, detail=f"Error processing link: {str(e)}")
    
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


@router.get("/process/status/{lecture_id}")
async def get_lecture_status(lecture_id: str):
    """Check lecture processing status"""
    try:
        supabase = get_supabase()
        response = supabase.table("lectures").select("id, title, status, error_message, created_at").eq("id", lecture_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Lecture not found")
        
        lecture = response.data[0]
        return {
            "id": lecture["id"],
            "title": lecture["title"],
            "status": lecture["status"],
            "error_message": lecture.get("error_message", ""),
            "created_at": lecture["created_at"],
        }
    except HTTPException:
        raise
    except Exception as e:
        # If error_message column doesn't exist, try without it
        try:
            response = supabase.table("lectures").select("id, title, status, created_at").eq("id", lecture_id).execute()
            if not response.data:
                raise HTTPException(status_code=404, detail="Lecture not found")
            lecture = response.data[0]
            return {
                "id": lecture["id"],
                "title": lecture["title"],
                "status": lecture["status"],
                "error_message": "",
                "created_at": lecture["created_at"],
            }
        except HTTPException:
            raise
        except:
            raise HTTPException(status_code=500, detail=str(e))

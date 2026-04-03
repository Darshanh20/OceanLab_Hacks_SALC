import os
import tempfile
import logging
from fastapi import APIRouter, BackgroundTasks, Form, HTTPException, Depends, Request
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


async def get_optional_user(request: Request) -> Optional[dict]:
    """Optional authentication - returns user if token is present, None otherwise"""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        from app.services.auth_service import decode_access_token
        token = auth_header.replace("Bearer ", "")
        payload = decode_access_token(token)
        if payload:
            return {"user_id": payload.get("sub"), "email": payload.get("email")}
    return None


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
    """Background task: upload to storage and process (lecture record already created)"""
    try:
        supabase = get_supabase()
        
        logger.info(f"[LINK] Starting upload and process for {source}: {title} (Lecture: {lecture_id})")
        
        # Upload to Supabase storage
        bucket_name = "lecture-audio"
        org_path = org_id or "default"
        group_path = group_id or "default"
        file_name = f"{org_path}/{group_path}/{Path(file_path).name}"
        
        logger.info(f"[LINK] Uploading audio to storage: {file_name}")
        with open(file_path, "rb") as f:
            supabase.storage.from_(bucket_name).upload(file_name, f)
        
        # Get public URL
        audio_url = supabase.storage.from_(bucket_name).get_public_url(file_name)
        logger.info(f"[LINK] Audio URL: {audio_url}")
        
        # Update lecture record with audio URL
        supabase.table("lectures").update({
            "audio_url": audio_url
        }).eq("id", lecture_id).execute()
        logger.info(f"[LINK] Updated lecture {lecture_id} with audio URL")
        
        # Start transcription pipeline
        await _process_link_lecture(lecture_id, file_path, audio_url)
        
        logger.info(f"[LINK] Successfully completed processing for lecture {lecture_id}")
        return {"success": True, "lecture_id": lecture_id}
    except Exception as e:
        logger.error(f"[LINK] Error in background task: {str(e)}", exc_info=True)
        # Update lecture status to failed
        try:
            supabase = get_supabase()
            update_data = {"status": "failed"}
            # Try to add error_message if column exists
            try:
                supabase.table("lectures").update(update_data).eq("id", lecture_id).execute()
            except:
                # Column might not exist, try with error_message anyway
                supabase.table("lectures").update({
                    "status": "failed",
                    "error_message": str(e)
                }).eq("id", lecture_id).execute()
            logger.info(f"[LINK] Updated lecture {lecture_id} status to failed")
        except Exception as db_error:
            logger.error(f"[LINK] Failed to update lecture status: {str(db_error)}")
        raise
    finally:
        # Cleanup temp file
        try:
            if os.path.exists(file_path):
                os.unlink(file_path)
                logger.info(f"[LINK] Cleaned up temp file: {file_path}")
        except Exception as cleanup_error:
            logger.warning(f"[LINK] Failed to cleanup temp file: {str(cleanup_error)}")


async def _process_link_lecture(lecture_id: str, file_path: str, audio_url: str) -> None:
    """Full pipeline: transcribe → summarize → RAG"""
    supabase = get_supabase()
    
    try:
        # Update status to transcribing
        logger.info(f"[LINK] Updating lecture {lecture_id} status to transcribing")
        supabase.table("lectures").update({"status": "transcribing"}).eq("id", lecture_id).execute()
        
        # Transcribe with Deepgram
        logger.info(f"[LINK] Starting Deepgram transcription for {file_path}")
        transcription_result = await transcribe_audio_deepgram(file_path)
        logger.info(f"[LINK] Transcription complete: {len(transcription_result.get('transcript_text', ''))} chars")
        
        # Update with transcription data
        update_data = {
            "transcript": transcription_result.get("transcript_text", ""),
            "summary": transcription_result.get("summary_text", ""),
            "status": "processing_rag",
        }
        
        if "topics" in transcription_result:
            update_data["topics"] = transcription_result["topics"]
        
        logger.info(f"[LINK] Updating lecture {lecture_id} with transcription data")
        supabase.table("lectures").update(update_data).eq("id", lecture_id).execute()
        
        # Process with RAG
        logger.info(f"[LINK] Starting RAG processing for lecture {lecture_id}")
        await process_lecture_for_rag(lecture_id, transcription_result.get("transcript_text", ""))
        logger.info(f"[LINK] RAG processing complete for lecture {lecture_id}")
        
        # Mark as completed
        logger.info(f"[LINK] Marking lecture {lecture_id} as completed")
        supabase.table("lectures").update({"status": "completed"}).eq("id", lecture_id).execute()
        logger.info(f"[LINK] Lecture {lecture_id} processing complete!")
    except Exception as e:
        logger.error(f"[LINK] Error processing lecture {lecture_id}: {str(e)}", exc_info=True)
        try:
            supabase.table("lectures").update({
                "status": "failed",
                "error_message": str(e)
            }).eq("id", lecture_id).execute()
            logger.info(f"[LINK] Updated lecture {lecture_id} status to failed")
        except Exception as db_error:
            logger.error(f"[LINK] Failed to update lecture failure status: {str(db_error)}")
        raise


@router.post("/process/link", response_model=LectureResponse)
async def process_link(
    url: str = Form(...),
    title: str = Form(default=""),
    org_id: str = Form(default=""),
    group_id: str = Form(default=""),
    background_tasks: BackgroundTasks = None,
    current_user: Optional[dict] = Depends(get_optional_user),
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
                "user_id": current_user.get("user_id") if current_user else None,
                "org_id": org_id if org_id and org_id != "default" else None,
                "group_id": group_id if group_id and group_id != "default" else None,
                "status": "uploading",
                "source": source,
            }
            
            logger.info(f"[LINK] Creating lecture record in database for {source}: {final_title}")
            response = supabase.table("lectures").insert(lecture_data).execute()
            
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
                    user_id=current_user.get("user_id") if current_user else None,
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

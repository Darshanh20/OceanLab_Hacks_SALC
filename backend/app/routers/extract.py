import os
import asyncio
import tempfile
import shutil
import logging
import re
import uuid
import subprocess
import mimetypes
from urllib.parse import urlparse, unquote, parse_qs
from fastapi import APIRouter, Form, HTTPException, Depends
from fastapi.responses import JSONResponse
from pathlib import Path
from typing import Optional
import httpx

from app.middleware.auth_middleware import get_current_user
from app.models.schemas import LectureResponse
from app.services.supabase_client import get_supabase
from app.services.transcription_service import transcribe_audio as deepgram_transcribe_audio, transcribe_audio_deepgram
from app.services.rag_service import process_lecture_for_rag
from app.utils.youtube import download_youtube_audio
from app.utils.drive import download_drive_file

# Set up logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

router = APIRouter()

VIDEO_EXTENSIONS = {".mp4", ".mkv", ".mov", ".avi", ".webm"}
AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".ogg", ".flac"}
SUPPORTED_DIRECT_MEDIA_EXTENSIONS = {
    ".mp3", ".mp4", ".wav", ".m4a", ".webm", ".ogg", ".flac", ".mov", ".avi", ".mkv"
}

# Keep task references to prevent silent drops and allow done-callback logging.
ACTIVE_DOWNLOADS: dict[str, asyncio.Task] = {}

STAGE_STATUS = {
    "queued": "queued",
    "downloading": "downloading",
    "converting": "converting",
    "uploading": "uploading",
    "transcribing": "transcribing",
    "processing_rag": "processing_rag",
    "completed": "completed",
    "failed": "failed",
    "cancelled": "cancelled",
}

# Backward compatibility in environments where DB status check constraint is not yet migrated.
LEGACY_STATUS_FALLBACK = {
    "queued": "uploading",
    "downloading": "uploading",
    "converting": "uploading",
    "uploading": "uploading",
    "transcribing": "transcribing",
    "processing_rag": "processing_rag",
    "completed": "completed",
    "failed": "failed",
    "cancelled": "failed",
}


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
        "error_message",
        "title",
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
        # Gracefully handle environments with old `lectures_status_check` values.
        if "status" in validated_data and "lectures_status_check" in str(e):
            fallback_status = LEGACY_STATUS_FALLBACK.get(validated_data["status"])
            if fallback_status and fallback_status != validated_data["status"]:
                retry_data = dict(validated_data)
                retry_data["status"] = fallback_status
                try:
                    logger.warning(
                        f"[DB] Status '{validated_data['status']}' not allowed by DB constraint; "
                        f"retrying with fallback '{fallback_status}'"
                    )
                    supabase.table("lectures").update(retry_data).eq("id", lecture_id).execute()
                    logger.info(f"[DB] Successfully updated lecture {lecture_id} with fallback status")
                    return True
                except Exception:
                    pass
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


def is_google_drive(url: str) -> bool:
    return "drive.google.com" in (url or "").lower()


def is_video(file_path: str):
    return Path(file_path).suffix.lower() in VIDEO_EXTENSIONS


def convert_video_to_audio(input_path: str) -> str:
    """
    Convert video to optimized audio for transcription.
    """
    input_file = Path(input_path)
    output_path = input_file.with_suffix(".mp3")

    command = [
        "ffmpeg",
        "-i", str(input_file),
        "-vn",
        "-acodec", "libmp3lame",
        "-ab", "64k",
        "-ar", "16000",
        "-ac", "1",
        "-y",
        str(output_path),
    ]

    subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    if not output_path.exists():
        raise Exception("Audio conversion failed")

    return str(output_path)


def _detect_link_type(url: str) -> str:
    """Auto-detect YouTube, Google Drive, or direct media link."""
    lower = (url or "").lower()
    if "youtube.com" in lower or "youtu.be" in lower:
        return "youtube"
    if is_google_drive(lower):
        return "google_drive"

    try:
        parsed = urlparse(url)
        ext = Path(unquote(parsed.path or "")).suffix.lower()
        if ext in SUPPORTED_DIRECT_MEDIA_EXTENSIONS:
            return "direct_media"
    except Exception:
        pass

    return "unknown"


async def _download_direct_media_file(url: str, temp_dir: str) -> dict:
    """Download direct audio/video URL to temp file."""
    parsed = urlparse(url)
    ext = Path(unquote(parsed.path or "")).suffix.lower()
    if ext not in SUPPORTED_DIRECT_MEDIA_EXTENSIONS:
        raise ValueError(
            "Please upload a direct audio/video file link (.mp3, .mp4, .wav, .m4a, .webm, .ogg, .flac, .mov, .avi, .mkv)"
        )

    filename = Path(unquote(parsed.path or "")).name or f"downloaded{ext}"
    file_path = str(Path(temp_dir) / filename)

    async with httpx.AsyncClient(timeout=1800.0, follow_redirects=True) as client:
        async with client.stream("GET", url) as response:
            if response.status_code != 200:
                raise ValueError(f"Failed to download direct link: HTTP {response.status_code}")

            with open(file_path, "wb") as f:
                async for chunk in response.aiter_bytes(chunk_size=8192):
                    if chunk:
                        f.write(chunk)

    if not Path(file_path).exists() or Path(file_path).stat().st_size < 1000:
        raise ValueError("Downloaded file is invalid")

    return {
        "file_path": file_path,
        "title": Path(filename).stem,
        "duration": 0,
        "source": "direct_media",
    }


def _infer_content_type(file_path: str) -> str:
    inferred, _ = mimetypes.guess_type(file_path)
    if inferred:
        return inferred
    # Keep a safe explicit default for audio files when extension is unknown.
    return "audio/mpeg"


def _format_mb(size_bytes: int) -> str:
    return f"{size_bytes / (1024 * 1024):.2f} MB"


def _extract_youtube_video_id(url: str) -> Optional[str]:
    """Extract YouTube video ID for safer structured logging."""
    try:
        parsed = urlparse(url)
        host = (parsed.netloc or "").lower()
        if "youtu.be" in host:
            return (parsed.path or "").lstrip("/") or None
        if "youtube.com" in host:
            query = parse_qs(parsed.query or "")
            video_id = (query.get("v") or [None])[0]
            if video_id:
                return video_id
            # Handle /shorts/<id> and /embed/<id>
            segments = [seg for seg in (parsed.path or "").split("/") if seg]
            if len(segments) >= 2 and segments[0] in {"shorts", "embed", "live"}:
                return segments[1]
    except Exception:
        return None
    return None


def _summarize_url(url: str) -> str:
    """Create a concise URL summary to avoid noisy/sensitive logs."""
    try:
        parsed = urlparse(url)
        host = parsed.netloc or "unknown-host"
        path = parsed.path or "/"
        return f"{host}{path}"
    except Exception:
        return "invalid-url"


def _emit_info(message: str) -> None:
    # Print guarantees visibility in uvicorn stdout even when logger handlers differ.
    print(message)
    logger.info(message)


def _schedule_link_processing_task(
    *,
    url: str,
    title: str,
    org_id: Optional[str],
    group_id: Optional[str],
    user_id: Optional[str],
    lecture_id: str,
) -> None:
    logger.info(f"[DEBUG] Scheduling async link processing task for lecture {lecture_id}")
    task = asyncio.create_task(
        _upload_and_process_link(
            url=url,
            title=title,
            org_id=org_id,
            group_id=group_id,
            user_id=user_id,
            lecture_id=lecture_id,
        ),
        name=f"link-process-{lecture_id}",
    )
    ACTIVE_DOWNLOADS[lecture_id] = task

    def _on_done(done_task: asyncio.Task) -> None:
        ACTIVE_DOWNLOADS.pop(lecture_id, None)
        if done_task.cancelled():
            logger.warning(f"[DEBUG] Async link task cancelled for lecture {lecture_id}")
            return
        exc = done_task.exception()
        if exc:
            logger.error(f"[DEBUG] Async link task crashed for lecture {lecture_id}: {exc}", exc_info=True)
        else:
            logger.info(f"[DEBUG] Async link task finished for lecture {lecture_id}")

    task.add_done_callback(_on_done)
    logger.info(f"[DEBUG] Async link processing task created for lecture {lecture_id}")


async def _upload_and_process_link(
    url: str,
    title: str,
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
    _emit_info(f"[TASK] BACKGROUND TASK STARTED lecture={lecture_id}")
    temp_dir = tempfile.mkdtemp()
    file_path = ""
    audio_path = ""
    source = "unknown"
    source_label = "Unknown"

    try:
        supabase = get_supabase()
        _emit_info(f"[LINK] Starting queued link processing for lecture {lecture_id}")

        _safe_update_lecture(supabase, lecture_id, {"status": STAGE_STATUS["downloading"]})
        link_type = _detect_link_type(url)
        logger.info(
            f"[LINK] lecture={lecture_id} detected link_type={link_type} "
            f"url={_summarize_url(url)}"
        )
        if link_type == "unknown":
            raise ValueError("Invalid URL. Supported: YouTube, Google Drive, or direct media link")

        if link_type == "youtube":
            yt_video_id = _extract_youtube_video_id(url)
            logger.info(
                f"[YOUTUBE] lecture={lecture_id} starting download "
                f"video_id={yt_video_id or 'unknown'} url={_summarize_url(url)}"
            )
            download_result = await download_youtube_audio(url, temp_dir)
            logger.info(
                f"[YOUTUBE] lecture={lecture_id} download completed "
                f"source={download_result.get('source', 'youtube')}"
            )
        elif link_type == "google_drive":
            download_result = await download_drive_file(
                url,
                temp_dir,
                cancel_check=lambda: lecture_id not in ACTIVE_DOWNLOADS,
            )
        else:
            download_result = await _download_direct_media_file(url, temp_dir)

        file_path = download_result["file_path"]
        source = download_result.get("source", link_type)
        source_label = source.replace("_", " ").title()

        downloaded_size = Path(file_path).stat().st_size
        if downloaded_size < 1000:
            raise ValueError("Downloaded file is invalid")

        downloaded_content_type = (download_result.get("content_type") or "").lower()
        if downloaded_content_type and not downloaded_content_type.startswith(("audio/", "video/", "application/octet-stream")):
            raise ValueError(
                f"Downloaded file is not audio/video (content-type: {downloaded_content_type}). "
                "Ensure the link points to a shared media file."
            )

        detected_title = download_result.get("title") or "downloaded_file"
        final_title = title or detected_title
        _safe_update_lecture(supabase, lecture_id, {"title": final_title})

        _emit_info(f"[DOWNLOAD] File path: {file_path}")
        _emit_info(f"[DOWNLOAD] Size: {Path(file_path).stat().st_size}")
        _emit_info(
            f"[DOWNLOAD] Source={source} path={file_path} size={_format_mb(downloaded_size)} "
            f"content_type={downloaded_content_type or 'unknown'}"
        )

        _emit_info(f"[LINK] Starting {source_label} processing for lecture {lecture_id}: {final_title}")
        _emit_info(f"[INPUT] Source file path: {file_path}")
        try:
            input_size = Path(file_path).stat().st_size
            _emit_info(f"[INPUT] Extracted video size: {_format_mb(input_size)}")
        except Exception:
            pass

        # Convert video inputs to optimized audio before upload/transcription.
        if is_video(file_path):
            _safe_update_lecture(supabase, lecture_id, {"status": STAGE_STATUS["converting"]})
            _emit_info(f"[CONVERT] Video input detected for {lecture_id}; starting video-to-audio conversion")
            _emit_info(f"[CONVERT] Converting {source_label} video to audio")
            audio_path = convert_video_to_audio(file_path)
            _emit_info(f"[CONVERT] Converted audio file path: {audio_path}")
            try:
                converted_size = Path(audio_path).stat().st_size
                _emit_info(f"[CONVERT] Converted audio size: {_format_mb(converted_size)}")
            except Exception:
                pass
        else:
            _emit_info(f"[CONVERT] Non-video input detected for {lecture_id}; skipping conversion")
            audio_path = file_path

        try:
            size_mb = Path(audio_path).stat().st_size / (1024 * 1024)
            _emit_info(f"[AUDIO] Ready for upload size: {size_mb:.2f} MB")
        except Exception:
            pass

        _emit_info(f"[AUDIO] Using audio file: {audio_path}")
        
        # =====================================================================
        # STAGE 1: Upload to Storage
        # =====================================================================
        try:
            bucket_name = "lecture-audio"
            org_path = org_id or "default"
            group_path = group_id or "default"
            _safe_update_lecture(supabase, lecture_id, {"status": STAGE_STATUS["uploading"]})
            
            # Sanitize filename to remove special characters that cause storage errors
            original_filename = Path(audio_path).name
            base_name = Path(original_filename).stem  # filename without extension
            extension = Path(original_filename).suffix  # .mp3, .wav, etc.
            
            # Add unique ID to prevent duplicate file conflicts in storage
            unique_id = str(uuid.uuid4())[:8]
            sanitized_name = f"{_sanitize_filename(base_name)}_{unique_id}{extension}"
            
            file_name = f"{org_path}/{group_path}/{sanitized_name}"
            
            _emit_info(f"[UPLOAD] Uploading audio to Supabase bucket 'lecture-audio' as {file_name}")
            _emit_info(f"[UPLOAD] Original filename: {original_filename}, Sanitized: {sanitized_name}")
            with open(audio_path, "rb") as f:
                supabase.storage.from_(bucket_name).upload(
                    file_name,
                    f,
                    {"content-type": "audio/mpeg"},
                )
            
            # Get public URL
            audio_url = supabase.storage.from_(bucket_name).get_public_url(file_name)
            _emit_info(f"[UPLOAD] Supabase public file URL: {audio_url}")
            _emit_info(f"[UPLOAD] Uploaded audio size: {_format_mb(Path(audio_path).stat().st_size)}")
            
            # Update lecture record with audio URL
            _safe_update_lecture(supabase, lecture_id, {
                "audio_url": audio_url,
                "status": STAGE_STATUS["transcribing"],
            })
            _emit_info(f"[UPLOAD] Successfully uploaded for lecture {lecture_id}")
        
        except Exception as e:
            logger.error(f"[UPLOAD FAILED] Could not upload to storage: {str(e)}", exc_info=True)
            _fail_lecture(supabase, lecture_id, e)
            raise
        
        # =====================================================================
        # STAGE 2: Transcription with Deepgram
        # =====================================================================
        transcription_result = None
        try:
            # Debug content type from storage URL before calling Deepgram.
            storage_content_type = "unknown"
            try:
                async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                    head_resp = await client.head(audio_url)
                    storage_content_type = head_resp.headers.get("Content-Type", "unknown")
                    logger.info(f"[TRANSCRIBE] CONTENT TYPE: {storage_content_type}")
            except Exception as head_err:
                logger.warning(f"[TRANSCRIBE] Could not inspect content type via HEAD: {head_err}")

            # Temporary robustness fallback:
            # If URL content-type is not media, use file-upload transcription path.
            if source == "google_drive" or not storage_content_type.startswith(("audio/", "video/")):
                logger.info("[TRANSCRIBE] Falling back to file-upload transcription path")
                transcription_result = await transcribe_audio_deepgram(audio_path)
            else:
                logger.info(f"[TRANSCRIBE] Starting Deepgram URL transcription for {audio_url}")
                transcription_result = await deepgram_transcribe_audio(audio_url)
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
                "status": STAGE_STATUS["processing_rag"],
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
            "status": STAGE_STATUS["completed"],
        })
        
        logger.info(f"[COMPLETE] Lecture {lecture_id} processing complete!")
        return {"success": True, "lecture_id": lecture_id}

    except asyncio.CancelledError:
        _emit_info(f"[CANCEL] Task cancelled for lecture {lecture_id}")
        try:
            supabase = get_supabase()
            _safe_update_lecture(supabase, lecture_id, {"status": STAGE_STATUS["cancelled"]})
        except Exception:
            pass
        return {"success": False, "lecture_id": lecture_id, "cancelled": True}
    
    except Exception as e:
        logger.error(f"[LINK] Fatal error in background task: {str(e)}", exc_info=True)
        try:
            _fail_lecture(get_supabase(), lecture_id, e)
        except Exception:
            pass
        raise
    
    finally:
        # Cleanup temp artifacts
        try:
            if audio_path and audio_path != file_path and os.path.exists(audio_path):
                os.unlink(audio_path)
                logger.info(f"[CLEANUP] Cleaned up converted audio: {audio_path}")
            if file_path and os.path.exists(file_path):
                os.unlink(file_path)
                logger.info(f"[CLEANUP] Cleaned up temp file: {file_path}")
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir, ignore_errors=True)
                logger.info(f"[CLEANUP] Removed temp directory: {temp_dir}")
        except Exception as cleanup_error:
            logger.warning(f"[CLEANUP] Failed to cleanup temp file: {str(cleanup_error)}")


@router.post("/process/link", response_model=LectureResponse)
async def process_link(
    url: str = Form(...),
    title: str = Form(default=""),
    org_id: str = Form(default=""),
    group_id: str = Form(default=""),
    current_user: dict = Depends(get_current_user),
):
    """
    Queue link processing and return immediately.
    """
    
    try:
        # Validate URL
        if not url or not url.strip():
            raise ValueError("URL cannot be empty")
        
        if not _can_write_lecture_scope():
            raise HTTPException(status_code=403, detail="Permission denied")
        
        link_type = _detect_link_type(url)
        logger.info(
            f"[LINK REQUEST] user={current_user.get('user_id')} link_type={link_type} "
            f"url={_summarize_url(url)}"
        )
        if link_type == "youtube":
            logger.info(
                f"[YOUTUBE REQUEST] user={current_user.get('user_id')} "
                f"video_id={_extract_youtube_video_id(url) or 'unknown'}"
            )
        if link_type == "unknown":
            raise ValueError(
                "Invalid URL. Supported: YouTube, Google Drive, or direct audio/video file links (.mp3/.mp4/etc)."
            )

        # Create lecture record synchronously (so we have ID for polling) and queue the rest.
        supabase = get_supabase()
        initial_title = title or "Processing link"
        lecture_data = {
            "title": initial_title,
            "user_id": current_user["user_id"],
            "org_id": org_id if org_id and org_id != "default" else None,
            "group_id": group_id if group_id and group_id != "default" else None,
            "status": STAGE_STATUS["queued"],
        }

        logger.info(f"[LINK] Creating queued lecture record for {link_type}: {initial_title}")
        try:
            response = supabase.table("lectures").insert(lecture_data).execute()
        except Exception as insert_error:
            if "lectures_status_check" in str(insert_error):
                fallback_data = dict(lecture_data)
                fallback_data["status"] = LEGACY_STATUS_FALLBACK["queued"]
                logger.warning(
                    "[DB] New status 'queued' not allowed by DB constraint; "
                    f"creating lecture with fallback status '{fallback_data['status']}'"
                )
                response = supabase.table("lectures").insert(fallback_data).execute()
            else:
                raise
        print(response)
        if not response.data:
            raise Exception("Failed to create lecture record - no data returned")

        created_lecture = response.data[0]
        lecture_id = created_lecture["id"]
        created_status = created_lecture.get("status", STAGE_STATUS["queued"])
        created_title = created_lecture.get("title", initial_title)
        logger.info(f"[LINK] Lecture created with ID: {lecture_id}")

        _schedule_link_processing_task(
            url=url,
            title=title,
            org_id=org_id,
            group_id=group_id,
            user_id=current_user["user_id"],
            lecture_id=lecture_id,
        )

        return LectureResponse(
            id=lecture_id,
            title=created_title,
            status=created_status,
            organization_id=org_id or "default",
            group_id=group_id or "default",
            source=link_type,
        )
    
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


@router.post("/process/cancel/{lecture_id}")
async def cancel_processing(
    lecture_id: str,
    current_user: dict = Depends(get_current_user),
):
    supabase = get_supabase()
    lecture_res = supabase.table("lectures").select("id,user_id").eq("id", lecture_id).limit(1).execute()
    if not lecture_res.data:
        raise HTTPException(status_code=404, detail="Lecture not found")
    if lecture_res.data[0].get("user_id") != current_user.get("user_id"):
        raise HTTPException(status_code=403, detail="Permission denied")

    task = ACTIVE_DOWNLOADS.get(lecture_id)
    if not task:
        raise HTTPException(status_code=404, detail="No active task")

    task.cancel()
    _safe_update_lecture(supabase, lecture_id, {"status": STAGE_STATUS["cancelled"]})

    return {"message": "Cancelled successfully", "lecture_id": lecture_id}


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

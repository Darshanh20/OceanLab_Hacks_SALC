import re
import asyncio
import mimetypes
import sys
import subprocess
import time
import logging
from pathlib import Path
from typing import Callable, Optional


logger = logging.getLogger(__name__)


def extract_drive_file_id(url: str) -> str:
    """Extract file ID from common Google Drive URL formats."""
    match = re.search(r"/d/([a-zA-Z0-9-_]+)", url)
    if match:
        return match.group(1)

    match = re.search(r"id=([a-zA-Z0-9_-]+)", url)
    if match:
        return match.group(1)

    raise ValueError("Invalid Google Drive URL")


async def download_drive_file(
    url: str,
    temp_dir: str,
    cancel_check: Optional[Callable[[], bool]] = None,
) -> dict:
    """Download a shared Google Drive file via gdown CLI with cancellation support."""
    return await download_drive_file_with_cancel(url, temp_dir, cancel_check=cancel_check)


async def _download_once(
    file_id: str,
    output_dir: Path,
    cancel_check: Optional[Callable[[], bool]] = None,
) -> Path:
    """Single attempt to download a file. May be retried by caller."""
    process: Optional[subprocess.Popen] = None
    try:
        # Use --fuzzy for more robust downloading
        cmd = [sys.executable, "-m", "gdown", "--fuzzy", "--id", file_id, "-O", str(output_dir)]
        logger.info(f"[DOWNLOAD] Starting gdown attempt for file_id={file_id}")
        
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        
        started_at = time.time()
        timeout_seconds = 1800
        next_heartbeat = started_at + 10

        # Wait for process to finish
        while True:
            # Check cancellation
            if cancel_check and cancel_check():
                logger.info(f"[DOWNLOAD] Cancel requested for file_id={file_id}; terminating gdown")
                process.terminate()
                for _ in range(20):
                    if process.poll() is not None:
                        break
                    await asyncio.sleep(0.1)
                if process.poll() is None:
                    process.kill()
                raise asyncio.CancelledError()

            # Check if process finished
            if process.poll() is not None:
                break

            # Heartbeat logging
            now = time.time()
            elapsed = int(now - started_at)
            if now >= next_heartbeat:
                logger.info(f"[DOWNLOAD] gdown still running for file_id={file_id} ({elapsed}s)")
                next_heartbeat = now + 10

            # Timeout check
            if elapsed >= timeout_seconds:
                process.terminate()
                for _ in range(20):
                    if process.poll() is not None:
                        break
                    await asyncio.sleep(0.1)
                if process.poll() is None:
                    process.kill()
                raise ValueError(f"gdown timed out after {timeout_seconds}s")

            await asyncio.sleep(1.0)

        # Process finished, check exit code
        stdout, stderr = process.communicate(timeout=5)
        if process.returncode != 0:
            details = (stderr or stdout or "").strip()
            raise ValueError(f"gdown exit code {process.returncode}: {details[:500]}")

        # CRITICAL: Wait for file finalization (rename from .part to final)
        logger.info(f"[DOWNLOAD] Process finished, waiting 2s for file finalization...")
        await asyncio.sleep(2)

        # Debug: list all files in directory
        all_files = list(output_dir.glob("*"))
        logger.info(f"[DOWNLOAD] Files in output_dir: {[f.name for f in all_files]}")

        # Find final file (exclude .part files and ensure size > 1000 bytes)
        valid_files = [
            f for f in all_files
            if f.is_file() and not f.name.endswith(".part") and f.stat().st_size > 1000
        ]

        if not valid_files:
            raise ValueError("Download incomplete - no final file found (only .part files or too small)")

        # Return the most recently modified valid file
        file_path = max(valid_files, key=lambda p: p.stat().st_mtime)
        logger.info(f"[DOWNLOAD] Found final file: {file_path.name} ({file_path.stat().st_size} bytes)")
        return file_path

    except asyncio.CancelledError:
        if process and process.poll() is None:
            process.terminate()
            for _ in range(20):
                if process.poll() is not None:
                    break
                await asyncio.sleep(0.1)
            if process.poll() is None:
                process.kill()
        raise
    except Exception as e:
        if process and process.poll() is None:
            process.terminate()
            for _ in range(20):
                if process.poll() is not None:
                    break
                await asyncio.sleep(0.1)
            if process.poll() is None:
                process.kill()
        # Re-raise without wrapping so caller can retry
        raise


async def download_drive_file_with_cancel(
    url: str,
    temp_dir: str,
    cancel_check: Optional[Callable[[], bool]] = None,
) -> dict:
    """Download Google Drive file with retry logic and cancellation support."""
    file_id = extract_drive_file_id(url)
    output_dir = Path(temp_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Retry logic: attempt up to 2 times
    last_error = None
    for attempt in range(2):
        try:
            logger.info(f"[DOWNLOAD] Attempt {attempt + 1}/2 for file_id={file_id}")
            file_path = await _download_once(file_id, output_dir, cancel_check)
            
            # Validate file extension and type
            if not file_path.suffix:
                raise ValueError("Downloaded file has no extension - cannot detect type")

            # Detect content type from file extension
            content_type, _ = mimetypes.guess_type(str(file_path))
            # Improve content-type detection for common formats
            if not content_type:
                ext_to_type = {
                    ".mp4": "video/mp4",
                    ".mov": "video/quicktime",
                    ".mkv": "video/x-matroska",
                    ".webm": "video/webm",
                    ".mp3": "audio/mpeg",
                    ".wav": "audio/wav",
                    ".m4a": "audio/mp4",
                }
                content_type = ext_to_type.get(file_path.suffix.lower(), "application/octet-stream")

            logger.info(f"[DOWNLOAD] Success: {file_path.name} ({content_type})")
            return {
                "file_path": str(file_path),
                "title": file_path.stem,
                "duration": 0,
                "source": "google_drive",
                "content_type": content_type.lower() if content_type else "application/octet-stream",
            }
        except asyncio.CancelledError:
            raise
        except Exception as e:
            last_error = e
            logger.warning(f"[DOWNLOAD] Attempt {attempt + 1}/2 failed: {e!r}")
            if attempt == 0:
                # Before retrying, wait a bit
                await asyncio.sleep(2)
            else:
                # Last attempt failed, raise
                raise ValueError(f"Google Drive download failed after 2 attempts: {last_error!r}")

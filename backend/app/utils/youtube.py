import os
import shutil
import subprocess
import tempfile
import sys
from pathlib import Path


def _resolve_ffmpeg_location() -> str | None:
    """Return a directory yt-dlp can use for FFmpeg, if available."""

    # ✅ 1. Check system-installed ffmpeg (Render/Linux)
    ffmpeg_path = shutil.which("ffmpeg")
    if ffmpeg_path:
        return os.path.dirname(ffmpeg_path)  # returns /usr/bin

    # ✅ 2. Fallback (Windows local dev)
    local_app_data = os.getenv("LOCALAPPDATA")
    if local_app_data:
        ffmpeg_root = Path(local_app_data) / "ffmpeg"
        if ffmpeg_root.exists():
            for bin_dir in ffmpeg_root.glob("**/bin"):
                if (bin_dir / "ffmpeg.exe").exists():
                    return str(bin_dir)

    return None


async def download_youtube_audio(url: str, temp_dir: str) -> dict:
    """Download audio from YouTube video using yt-dlp"""
    try:
        # Check if yt-dlp is installed
        try:
            subprocess.run([sys.executable, "-m", "yt_dlp", "--version"], capture_output=True, check=True, timeout=5)
        except (subprocess.CalledProcessError, FileNotFoundError):
            raise ValueError("yt-dlp is not installed. Please install it using: pip install yt-dlp")

        ffmpeg_location = _resolve_ffmpeg_location()
        if ffmpeg_location is None and not shutil.which("ffmpeg"):
            raise ValueError("FFmpeg is required but not installed. Please install FFmpeg (https://ffmpeg.org/download.html)")
        
        output_template = os.path.join(temp_dir, "%(title)s.%(ext)s")
        
        # Use yt-dlp to download best audio and convert to MP3 with FFmpeg
        ytdlp_command = [
            sys.executable,
            "-m",
            "yt_dlp",
            "-f", "bestaudio/best",
            "--extract-audio",
            "--audio-format", "mp3",
            "--audio-quality", "192",
            "-o", output_template,
            url,
        ]
        if ffmpeg_location:
            ytdlp_command.extend(["--ffmpeg-location", ffmpeg_location])

        result = subprocess.run(
            ytdlp_command,
            capture_output=True,
            text=True,
            timeout=300,
        )
        
        if result.returncode != 0:
            error_msg = result.stderr.lower()
            if "private" in error_msg or "unextractable" in error_msg:
                raise ValueError("This YouTube video is private or unavailable for download")
            if "ffmpeg" in error_msg or "postprocessor" in error_msg:
                raise ValueError("FFmpeg is required but not installed. Please install FFmpeg (https://ffmpeg.org/download.html)")
            raise ValueError(f"Failed to download video: {result.stderr[:200]}")
        
        # Find the downloaded MP3 file
        files = list(Path(temp_dir).glob("*.mp3"))
        if not files:
            raise ValueError("No audio file was generated - the download may have failed")
        
        file_path = str(files[0].absolute())
        title = files[0].stem
        
        return {
            "file_path": file_path,
            "title": title,
            "duration": 0,
            "source": "youtube",
        }
    except subprocess.TimeoutExpired:
        raise ValueError("Download timeout - video too long or connection issue. Please try a shorter video.")
    except ValueError:
        raise
    except Exception as e:
        raise ValueError(f"YouTube download error: {str(e)[:200]}")

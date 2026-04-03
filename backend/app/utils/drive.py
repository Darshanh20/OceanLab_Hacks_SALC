import re
import tempfile
from pathlib import Path
import httpx


def extract_drive_file_id(url: str) -> str:
    """Extract file ID from various Google Drive URL formats"""
    # Format: /file/d/{id}
    match = re.search(r"/file/d/([a-zA-Z0-9-_]+)", url)
    if match:
        return match.group(1)
    
    # Format: ?id={id}
    match = re.search(r"[?&]id=([a-zA-Z0-9-_]+)", url)
    if match:
        return match.group(1)
    
    # Format: /d/{id}
    match = re.search(r"/d/([a-zA-Z0-9-_]+)", url)
    if match:
        return match.group(1)
    
    raise ValueError("Could not extract file ID from Google Drive URL - ensure URL is in format: https://drive.google.com/file/d/{ID} or https://drive.google.com/open?id={ID}")


async def download_drive_file(url: str, temp_dir: str) -> dict:
    """Download file from Google Drive using httpx"""
    try:
        file_id = extract_drive_file_id(url)
        
        # Google Drive export URL (bypasses virus scan)
        download_url = f"https://drive.google.com/uc?export=download&id={file_id}"
        
        async with httpx.AsyncClient(follow_redirects=True, timeout=60) as client:
            response = await client.get(download_url)
            
            if response.status_code == 404:
                raise ValueError(f"Google Drive file not found - file_id: {file_id}")
            
            if response.status_code == 403:
                raise ValueError("Access denied - file is private or sharing not enabled. Please ensure the file is shared as 'Anyone with the link can view'")
            
            if response.status_code == 400:
                raise ValueError("Bad request - invalid Google Drive URL or file ID")
            
            if response.status_code != 200:
                raise ValueError(f"Failed to download from Google Drive: HTTP {response.status_code}")
            
            # Check if response has content
            if not response.content:
                raise ValueError("Google Drive returned empty response - file may be invalid or too large")
            
            # Extract filename from Content-Disposition header or use default
            content_disposition = response.headers.get("content-disposition", "")
            filename = "downloaded_file"
            
            if "filename" in content_disposition:
                match = re.search(r'filename="?([^"]+)"?', content_disposition)
                if match:
                    filename = match.group(1)
            
            # Save file to temp directory
            file_path = str(Path(temp_dir) / filename)
            with open(file_path, "wb") as f:
                f.write(response.content)
            
            # Verify file was written
            if not Path(file_path).exists() or Path(file_path).stat().st_size == 0:
                raise ValueError(f"Failed to save downloaded file - file may be corrupted or empty")
            
            return {
                "file_path": file_path,
                "title": Path(filename).stem,
                "duration": 0,
                "source": "google_drive",
            }
    except ValueError:
        raise
    except httpx.TimeoutException:
        raise ValueError("Download timeout - connection took too long. The file may be too large or connection too slow")
    except Exception as e:
        raise ValueError(f"Google Drive download error: {str(e)[:200]}")

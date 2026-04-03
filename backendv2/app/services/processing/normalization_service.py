"""
Enhanced normalization service with advanced features.

Handles:
- Speaker detection and assignment
- Language detection
- Noise cleanup and punctuation fixes
- Unified format enforcement
"""

import json
import re
from typing import Dict, Any, Optional, List


def normalize_ingested_data(
    ingested_data: Dict[str, Any],
    input_type: str = "",
    filename: str = "",
    apply_language_detection: bool = True,
    apply_speaker_detection: bool = True,
    apply_cleanup: bool = True
) -> Dict[str, Any]:
    """
    Normalize ingested data to unified format with advanced features.
    
    Args:
        ingested_data: Raw ingestion output
        input_type: "audio" | "video" | "document" | "transcript"
        filename: Original filename
        apply_language_detection: Auto-detect language
        apply_speaker_detection: Apply fallback speaker assignment
        apply_cleanup: Clean up noise, punctuation, filler words
    
    Returns:
        {
            "text": "Full normalized text",
            "transcript_json": {
                "segments": [...],
                "duration_seconds": int,
                "word_count": int,
                "language": str,
                "source_type": str,
                "confidence": float,
                "speakers": [str],
                "metadata": {...}
            }
        }
    """
    # Extract raw text
    transcript_text = ingested_data.get("transcript_text", "")
    raw_transcript_json = ingested_data.get("transcript_json", {})
    
    # Parse existing JSON if string
    if isinstance(raw_transcript_json, str):
        try:
            raw_transcript_json = json.loads(raw_transcript_json)
        except:
            raw_transcript_json = {}
    
    # Initialize unified structure
    segments = raw_transcript_json.get("segments", [])
    
    # Apply speaker detection if needed
    if apply_speaker_detection and segments:
        segments = _apply_speaker_detection(segments)
    
    # Apply language detection
    language = "en"
    if apply_language_detection:
        language = _detect_language(transcript_text)
    
    # Apply cleanup
    if apply_cleanup:
        transcript_text = _cleanup_text(transcript_text)
        segments = _cleanup_segments(segments)
    
    # Extract unique speakers
    speakers = list(set(s.get("speaker", "Unknown") for s in segments if s.get("speaker")))
    if not speakers and segments:
        speakers = ["Speaker 1"]
    
    # Calculate metrics
    word_count = len(transcript_text.split())
    duration_seconds = 0
    if segments:
        max_end = max(s.get("end", 0) for s in segments)
        duration_seconds = max_end // 1000 if max_end > 1000 else int(max_end)
    
    # Build unified format
    unified_format = {
        "text": transcript_text,
        "transcript_json": json.dumps({
            "segments": segments,
            "duration_seconds": duration_seconds,
            "word_count": word_count,
            "language": language,
            "source_type": input_type or "unknown",
            "confidence": raw_transcript_json.get("confidence", 0.95),
            "speakers": speakers,
            "speaker_count": len(speakers),
            "metadata": {
                "filename": filename,
                "original_format": raw_transcript_json.get("format", "unknown"),
                "cleaned": apply_cleanup,
                "detected_language": language != "en"
            }
        })
    }
    
    return unified_format


def _apply_speaker_detection(segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Apply fallback speaker assignment if needed.
    
    If speaker field is missing or empty, assigns Speaker 1, Speaker 2, etc.
    """
    result = []
    speaker_map = {}
    next_speaker_id = 1
    
    for segment in segments:
        speaker = segment.get("speaker", "").strip()
        
        if not speaker or speaker == "Unknown":
            # Check if we've seen this speaker pattern before
            if "Unknown" not in speaker_map:
                speaker_map["Unknown"] = f"Speaker {next_speaker_id}"
                next_speaker_id += 1
            speaker = speaker_map["Unknown"]
        else:
            # Map consistent speaker names
            if speaker not in speaker_map:
                speaker_map[speaker] = f"Speaker {next_speaker_id}"
                next_speaker_id += 1
            speaker = speaker_map[speaker]
        
        segment["speaker"] = speaker
        result.append(segment)
    
    return result


def _detect_language(text: str) -> str:
    """
    Simple language detection (placeholder).
    
    In production, use: langdetect, textblob, or ML model
    
    Returns: ISO 639-1 language code (en, es, fr, etc.)
    """
    # Placeholder - always return 'en'
    # Real implementation would use langdetect library:
    # from langdetect import detect
    # return detect(text)
    
    return "en"


def _cleanup_text(text: str) -> str:
    """
    Clean up text:
    - Remove filler words
    - Fix punctuation
    - Remove excessive whitespace
    """
    # Remove common filler words
    filler_words = [
        r'\bum\b', r'\buh\b', r'\berr\b', r'\blike\b', r'\byou know\b',
        r'\bkind of\b', r'\bsort of\b', r'\bI mean\b'
    ]
    
    for filler in filler_words:
        text = re.sub(filler, '', text, flags=re.IGNORECASE)
    
    # Fix multiple spaces
    text = re.sub(r'\s+', ' ', text)
    
    # Fix punctuation spacing
    text = re.sub(r'\s+([.,!?;:])', r'\1', text)
    
    # Remove leading/trailing whitespace
    text = text.strip()
    
    return text


def _cleanup_segments(segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Clean up individual segments."""
    result = []
    
    for segment in segments:
        # Clean text
        text = segment.get("text", "").strip()
        text = re.sub(r'\s+', ' ', text)
        
        if text:  # Only keep non-empty segments
            segment["text"] = text
            result.append(segment)
    
    return result

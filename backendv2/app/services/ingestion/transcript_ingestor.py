"""
Enhanced transcript ingestor with multi-format support.

Supports Zoom, Google Meet, Microsoft Teams, Deepgram formats.
Parses structure and extracts speaker segments.
"""

import json
from typing import Optional, List, Dict, Any


async def ingest_transcript(file_content: bytes, filename: str) -> dict:
    """
    Enhanced transcript ingestion with format detection.
    
    Supports:
    - Zoom exported JSON/VTT
    - Google Meet exported VTT/TXT
    - Microsoft Teams exported JSON
    - Deepgram JSON
    - Plain text transcripts
    
    Returns:
        {
            "transcript_text": str,
            "transcript_json": dict with segments,
            "source_type": "transcript",
            "format": "zoom|meet|teams|deepgram|plaintext",
            "speaker_count": int
        }
    """
    try:
        content_str = file_content.decode("utf-8")
        
        # Detect format
        if filename.lower().endswith(".json"):
            return await _parse_json_transcript(content_str, filename)
        elif filename.lower().endswith(".vtt"):
            return await _parse_vtt_transcript(content_str)
        elif filename.lower().endswith(".srt"):
            return await _parse_srt_transcript(content_str)
        else:
            # Plain text
            return _parse_plaintext_transcript(content_str)
    
    except Exception as e:
        raise Exception(f"Transcript ingestion failed: {str(e)}")


async def _parse_json_transcript(content_str: str, filename: str) -> dict:
    """Parse JSON transcripts from various platforms."""
    try:
        data = json.loads(content_str)
    except json.JSONDecodeError:
        raise ValueError("Invalid JSON format for transcript")
    
    # Detect format by structure
    if "transcript" in data:
        # Zoom format
        return _parse_zoom_format(data)
    elif "utterances" in data:
        # Deepgram format
        return _parse_deepgram_format(data)
    elif "captions" in data:
        # Google Meet export format
        return _parse_meet_format(data)
    elif "turns" in data or "messages" in data:
        # Teams format
        return _parse_teams_format(data)
    else:
        # Generic JSON - try to extract transcript_text
        text = data.get("text") or json.dumps(data)
        return {
            "transcript_text": text,
            "transcript_json": json.dumps({
                "segments": [],
                "source_type": "transcript",
                "format": "generic_json"
            }),
            "source_type": "transcript",
            "format": "generic_json",
            "speaker_count": 0
        }


def _parse_zoom_format(data: dict) -> dict:
    """
    Parse Zoom transcript export format.
    
    Expected structure:
    {
        "transcript": [
            {
                "user_name": "John Doe",
                "timestamp": "2024-01-01 10:00:00",
                "language": "en",
                "sentences": [
                    {
                        "start_time": 0,
                        "end_time": 5000,
                        "text": "Hello everyone"
                    }
                ]
            }
        ]
    }
    """
    segments = []
    speakers = set()
    full_text_parts = []
    
    for entry in data.get("transcript", []):
        speaker = entry.get("user_name", "Unknown Speaker")
        speakers.add(speaker)
        
        for sentence in entry.get("sentences", []):
            segment = {
                "speaker": speaker,
                "text": sentence.get("text", ""),
                "start": sentence.get("start_time", 0),
                "end": sentence.get("end_time", 0),
                "confidence": 0.95
            }
            segments.append(segment)
            full_text_parts.append(sentence.get("text", ""))
    
    full_text = " ".join(full_text_parts)
    
    return {
        "transcript_text": full_text,
        "transcript_json": json.dumps({
            "segments": segments,
            "duration_seconds": segments[-1]["end"] // 1000 if segments else 0,
            "word_count": len(full_text.split()),
            "language": "en",
            "source_type": "transcript",
            "format": "zoom",
            "speaker_count": len(speakers)
        }),
        "source_type": "transcript",
        "format": "zoom",
        "speaker_count": len(speakers)
    }


def _parse_deepgram_format(data: dict) -> dict:
    """
    Parse Deepgram transcript export format.
    
    Expected structure:
    {
        "utterances": [
            {
                "speaker": 1,
                "transcript": "...",
                "start": 0,
                "end": 5
            }
        ],
        "confidence": 0.95
    }
    """
    segments = []
    speakers = set()
    full_text_parts = []
    
    for utterance in data.get("utterances", []):
        speaker = f"Speaker {utterance.get('speaker', 1)}"
        speakers.add(speaker)
        
        segment = {
            "speaker": speaker,
            "text": utterance.get("transcript", ""),
            "start": int(utterance.get("start", 0) * 1000),  # Convert to ms
            "end": int(utterance.get("end", 0) * 1000),
            "confidence": data.get("confidence", 0.95)
        }
        segments.append(segment)
        full_text_parts.append(utterance.get("transcript", ""))
    
    full_text = " ".join(full_text_parts)
    
    return {
        "transcript_text": full_text,
        "transcript_json": json.dumps({
            "segments": segments,
            "duration_seconds": max([s["end"] for s in segments]) // 1000 if segments else 0,
            "word_count": len(full_text.split()),
            "language": "en",
            "source_type": "transcript",
            "format": "deepgram",
            "speaker_count": len(speakers)
        }),
        "source_type": "transcript",
        "format": "deepgram",
        "speaker_count": len(speakers)
    }


def _parse_meet_format(data: dict) -> dict:
    """Parse Google Meet format."""
    segments = []
    full_text_parts = []
    
    for caption in data.get("captions", []):
        segment = {
            "speaker": caption.get("speaker", "Unknown"),
            "text": caption.get("text", ""),
            "start": caption.get("start_time", 0),
            "end": caption.get("end_time", 0),
            "confidence": 0.95
        }
        segments.append(segment)
        full_text_parts.append(caption.get("text", ""))
    
    full_text = " ".join(full_text_parts)
    speakers = set(s["speaker"] for s in segments)
    
    return {
        "transcript_text": full_text,
        "transcript_json": json.dumps({
            "segments": segments,
            "duration_seconds": max([s["end"] for s in segments]) if segments else 0,
            "word_count": len(full_text.split()),
            "language": "en",
            "source_type": "transcript",
            "format": "meet",
            "speaker_count": len(speakers)
        }),
        "source_type": "transcript",
        "format": "meet",
        "speaker_count": len(speakers)
    }


def _parse_teams_format(data: dict) -> dict:
    """Parse Microsoft Teams format."""
    segments = []
    full_text_parts = []
    
    # Teams can export as "turns" or "messages"
    messages = data.get("turns") or data.get("messages", [])
    
    for msg in messages:
        segment = {
            "speaker": msg.get("from") or msg.get("speaker", "Unknown"),
            "text": msg.get("content") or msg.get("text", ""),
            "start": msg.get("start_time", 0),
            "end": msg.get("end_time", 0),
            "confidence": 0.95
        }
        segments.append(segment)
        full_text_parts.append(msg.get("content") or msg.get("text", ""))
    
    full_text = " ".join(full_text_parts)
    speakers = set(s["speaker"] for s in segments)
    
    return {
        "transcript_text": full_text,
        "transcript_json": json.dumps({
            "segments": segments,
            "duration_seconds": max([s["end"] for s in segments]) if segments else 0,
            "word_count": len(full_text.split()),
            "language": "en",
            "source_type": "transcript",
            "format": "teams",
            "speaker_count": len(speakers)
        }),
        "source_type": "transcript",
        "format": "teams",
        "speaker_count": len(speakers)
    }


async def _parse_vtt_transcript(content_str: str) -> dict:
    """Parse WebVTT (Video Text Tracks) format."""
    lines = content_str.strip().split("\n")
    segments = []
    full_text_parts = []
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # Look for timestamp line (HH:MM:SS.mmm --> HH:MM:SS.mmm)
        if " --> " in line:
            times = line.split(" --> ")
            start_ms = _vtt_time_to_ms(times[0].strip())
            end_ms = _vtt_time_to_ms(times[1].strip())
            
            # Next line should be text
            i += 1
            if i < len(lines):
                text = lines[i].strip()
                segment = {
                    "speaker": "Speaker 1",
                    "text": text,
                    "start": start_ms,
                    "end": end_ms,
                    "confidence": 0.95
                }
                segments.append(segment)
                full_text_parts.append(text)
        
        i += 1
    
    full_text = " ".join(full_text_parts)
    
    return {
        "transcript_text": full_text,
        "transcript_json": json.dumps({
            "segments": segments,
            "duration_seconds": max([s["end"] for s in segments]) // 1000 if segments else 0,
            "word_count": len(full_text.split()),
            "language": "en",
            "source_type": "transcript",
            "format": "vtt"
        }),
        "source_type": "transcript",
        "format": "vtt",
        "speaker_count": 1
    }


async def _parse_srt_transcript(content_str: str) -> dict:
    """Parse SubRip (SRT) format."""
    blocks = content_str.strip().split("\n\n")
    segments = []
    full_text_parts = []
    
    for block in blocks:
        lines = block.strip().split("\n")
        if len(lines) < 3:
            continue
        
        # Format: index, timestamp, text
        try:
            times = lines[1].split(" --> ")
            start_ms = _srt_time_to_ms(times[0].strip())
            end_ms = _srt_time_to_ms(times[1].strip())
            text = " ".join(lines[2:])
            
            segment = {
                "speaker": "Speaker 1",
                "text": text,
                "start": start_ms,
                "end": end_ms,
                "confidence": 0.95
            }
            segments.append(segment)
            full_text_parts.append(text)
        except:
            continue
    
    full_text = " ".join(full_text_parts)
    
    return {
        "transcript_text": full_text,
        "transcript_json": json.dumps({
            "segments": segments,
            "duration_seconds": max([s["end"] for s in segments]) // 1000 if segments else 0,
            "word_count": len(full_text.split()),
            "language": "en",
            "source_type": "transcript",
            "format": "srt"
        }),
        "source_type": "transcript",
        "format": "srt",
        "speaker_count": 1
    }


def _parse_plaintext_transcript(content_str: str) -> dict:
    """Parse plain text transcript."""
    text = content_str.strip()
    
    if not text:
        raise ValueError("Transcript file is empty")
    
    return {
        "transcript_text": text,
        "transcript_json": json.dumps({
            "segments": [],
            "source_type": "transcript",
            "format": "plaintext"
        }),
        "source_type": "transcript",
        "format": "plaintext",
        "speaker_count": 0
    }


def _vtt_time_to_ms(time_str: str) -> int:
    """Convert VTT time format (HH:MM:SS.mmm) to milliseconds."""
    parts = time_str.split(":")
    hours = int(parts[0])
    minutes = int(parts[1])
    seconds = float(parts[2])
    return int((hours * 3600 + minutes * 60 + seconds) * 1000)


def _srt_time_to_ms(time_str: str) -> int:
    """Convert SRT time format (HH:MM:SS,mmm) to milliseconds."""
    time_str = time_str.replace(",", ".")
    parts = time_str.split(":")
    hours = int(parts[0])
    minutes = int(parts[1])
    seconds = float(parts[2])
    return int((hours * 3600 + minutes * 60 + seconds) * 1000)

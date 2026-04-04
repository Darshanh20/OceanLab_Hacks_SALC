import httpx
from app.config import DEEPGRAM_API_KEY

DEEPGRAM_URL = "https://api.deepgram.com/v1/listen"


def parse_deepgram_response(data: dict) -> dict:
    result = data.get("results", {})
    channels = result.get("channels", [{}])
    channel = channels[0] if channels else {}
    alternatives = channel.get("alternatives", [{}])
    alt = alternatives[0] if alternatives else {}

    transcript_text = alt.get("transcript", "")
    words = alt.get("words", [])
    utterances = result.get("utterances", [])
    detected_lang = channel.get("detected_language", "en")

    structured_utterances = []
    for utt in utterances:
        structured_utterances.append({
            "speaker": utt.get("speaker", 0),
            "start": round(utt.get("start", 0), 2),
            "end": round(utt.get("end", 0), 2),
            "text": utt.get("transcript", ""),
        })

    speakers = list(set(u.get("speaker", 0) for u in utterances))
    speaker_labels = {}
    for i, sp in enumerate(sorted(speakers)):
        if i == 0:
            speaker_labels[sp] = "Speaker 1 (Faculty)"
        else:
            speaker_labels[sp] = f"Speaker {i + 1} (Student)"

    duration = 0
    if words:
        duration = round(words[-1].get("end", 0), 2)

    summary_data = result.get("summary", {})
    summary_text = summary_data.get("short", "") or summary_data.get("text", "")
    topics = result.get("topics", [])

    return {
        "transcript_text": transcript_text,
        "utterances": structured_utterances,
        "speaker_labels": speaker_labels,
        "detected_language": detected_lang,
        "duration_seconds": duration,
        "word_count": len(words),
        "summary_text": summary_text,
        "topics": topics,
    }


async def submit_transcription_job(audio_url: str, callback_url: str) -> dict:
    """
    Submit a URL-based async Deepgram transcription job.
    Deepgram will call `callback_url` when transcription is complete.
    """
    if not DEEPGRAM_API_KEY:
        raise RuntimeError("DEEPGRAM_API_KEY is not set")

    params = {
        "model": "nova-2",
        "smart_format": "true",
        "punctuate": "true",
        "diarize": "true",
        "utterances": "true",
        "detect_language": "true",
        "paragraphs": "true",
        "summarize": "true",
        "topics": "true",
        "callback": callback_url,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            DEEPGRAM_URL,
            headers={
                "Authorization": f"Token {DEEPGRAM_API_KEY}",
                "Content-Type": "application/json",
            },
            json={"url": audio_url},
            params=params,
        )

        if response.status_code not in (200, 202):
            raise RuntimeError(
                f"Deepgram submit error: {response.status_code} - {response.text}"
            )

        return response.json() if response.text else {}


async def transcribe_audio(audio_url: str) -> dict:
    """
    Transcribe audio using Deepgram API with:
    - Speaker diarization (multi-speaker detection)
    - Word-level timestamps
    - Utterance detection (sentence-level timestamps)
    - Language detection
    - Punctuation and smart formatting
    
    Returns dict with transcript text, utterances, and metadata.
    """
    if not DEEPGRAM_API_KEY:
        raise RuntimeError("DEEPGRAM_API_KEY is not set")

    params = {
        "url": audio_url,
        "model": "nova-2",
        "smart_format": "true",
        "punctuate": "true",
        "diarize": "true",
        "utterances": "true",
        "detect_language": "true",
        "paragraphs": "true",
        "summarize": "true",
        "topics": "true",
    }

    async with httpx.AsyncClient(timeout=600.0) as client:
        response = await client.post(
            DEEPGRAM_URL,
            headers={
                "Authorization": f"Token {DEEPGRAM_API_KEY}",
                "Content-Type": "application/json",
            },
            json={"url": audio_url},
            params=params,
        )

        if response.status_code != 200:
            raise RuntimeError(
                f"Deepgram API error: {response.status_code} - {response.text}"
            )

        return parse_deepgram_response(response.json())


async def transcribe_audio_deepgram(file_path: str) -> dict:
    """
    Transcribe local audio file using Deepgram API.
    Handles file uploading with multi-part form data.
    """
    if not DEEPGRAM_API_KEY:
        raise RuntimeError("DEEPGRAM_API_KEY is not set")

    params = {
        "model": "nova-2",
        "smart_format": "true",
        "punctuate": "true",
        "diarize": "true",
        "utterances": "true",
        "detect_language": "true",
        "paragraphs": "true",
        "summarize": "true",
        "topics": "true",
    }

    async with httpx.AsyncClient(timeout=600.0) as client:
        # Read file and send as multipart
        with open(file_path, "rb") as f:
            files = {"file": (file_path.split("/")[-1], f, "audio/mpeg")}
            response = await client.post(
                DEEPGRAM_URL,
                headers={"Authorization": f"Token {DEEPGRAM_API_KEY}"},
                params=params,
                files=files,
            )

        if response.status_code != 200:
            raise RuntimeError(
                f"Deepgram API error: {response.status_code} - {response.text}"
            )

        return parse_deepgram_response(response.json())

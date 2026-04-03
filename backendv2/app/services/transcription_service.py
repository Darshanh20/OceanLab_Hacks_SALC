import httpx
from app.config import DEEPGRAM_API_KEY

DEEPGRAM_URL = "https://api.deepgram.com/v1/listen"


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

        data = response.json()
        result = data.get("results", {})
        channels = result.get("channels", [{}])
        channel = channels[0] if channels else {}
        alternatives = channel.get("alternatives", [{}])
        alt = alternatives[0] if alternatives else {}

        # Full transcript text
        transcript_text = alt.get("transcript", "")

        # Word-level data with timestamps and speaker labels
        words = alt.get("words", [])

        # Utterances (sentence-level with speaker + timestamps)
        utterances = result.get("utterances", [])

        # Detected language
        detected_lang = channel.get("detected_language", "en")

        # Build structured transcript with speakers and timestamps
        structured_utterances = []
        for utt in utterances:
            structured_utterances.append({
                "speaker": utt.get("speaker", 0),
                "start": round(utt.get("start", 0), 2),
                "end": round(utt.get("end", 0), 2),
                "text": utt.get("transcript", ""),
            })

        # Get unique speakers
        speakers = list(set(u.get("speaker", 0) for u in utterances))
        speaker_labels = {}
        for i, sp in enumerate(sorted(speakers)):
            if i == 0:
                speaker_labels[sp] = "Speaker 1 (Faculty)"
            else:
                speaker_labels[sp] = f"Speaker {i + 1} (Student)"

        # Duration
        duration = 0
        if words:
            duration = round(words[-1].get("end", 0), 2)

        return {
            "transcript_text": transcript_text,
            "utterances": structured_utterances,
            "speaker_labels": speaker_labels,
            "detected_language": detected_lang,
            "duration_seconds": duration,
            "word_count": len(words),
        }

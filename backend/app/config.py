import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
DEEPGRAM_API_KEY: str = os.getenv("DEEPGRAM_API_KEY", "")
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
COHERE_API_KEY: str = os.getenv("COHERE_API_KEY", "")
JWT_SECRET: str = os.getenv("JWT_SECRET", "change-this-secret-key")
JWT_ALGORITHM: str = "HS256"
JWT_EXPIRATION_HOURS: int = 24
DEEPGRAM_CALLBACK_URL: str = os.getenv("DEEPGRAM_CALLBACK_URL", "")
DEEPGRAM_WEBHOOK_TOKEN: str = os.getenv("DEEPGRAM_WEBHOOK_TOKEN", "")
MAX_AUDIO_SIZE_MB: int = 25
ALLOWED_MEDIA_TYPES: list[str] = [
    "audio/mpeg", "audio/wav", "audio/mp4", "audio/x-m4a",
    "audio/ogg", "audio/webm", "audio/flac",
    "video/mp4", "video/webm", "video/quicktime", "video/x-msvideo",
    "video/x-matroska",

    # Documents (text extraction; no OCR)
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # .docx
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",   # .pptx
]

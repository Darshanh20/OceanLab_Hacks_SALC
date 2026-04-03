"""
Summary pipeline.

Fetches or generates cached lecture summaries.
"""

from app.services.ai.summary_service import generate_cached_summary


async def run_summary_pipeline(lecture_id: str, format_type: str = "detailed") -> dict:
    summary, cached = await generate_cached_summary(lecture_id, format_type=format_type)
    return {
        "lecture_id": lecture_id,
        "status": "summary_ready",
        "cached": cached,
        "format_type": format_type,
        "summary": summary,
    }

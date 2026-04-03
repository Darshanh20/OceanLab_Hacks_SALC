"""
Summary cache/service layer.

Provides cached lecture summaries backed by the lecture_analysis table.
"""

from typing import Tuple

from app.services.db.analysis_repo import get_analysis, save_analysis
from app.services.db.lecture_repo import get_lecture, update_lecture
from app.services.summary_service import generate_summary as generate_full_summary


def _cache_key(format_type: str) -> str:
    return f"summary_{format_type or 'detailed'}"


async def generate_cached_summary(
    lecture_id: str,
    format_type: str = "detailed",
    force_refresh: bool = False,
) -> Tuple[str, bool]:
    """Generate or fetch a cached summary for a lecture."""
    cache_key = _cache_key(format_type)

    cached = get_analysis(lecture_id, cache_key)
    if cached and cached.get("content") and not force_refresh:
        return cached["content"], True

    lecture = get_lecture(lecture_id)
    if not lecture or not lecture.get("transcript_text"):
        raise ValueError("Lecture not found or missing transcript_text")

    summary = await generate_full_summary(lecture["transcript_text"], format_type)
    try:
        save_analysis(lecture_id, cache_key, summary)
    except Exception:
        pass

    try:
        update_lecture(lecture_id, {"summary_text": summary})
    except Exception:
        pass

    return summary, False

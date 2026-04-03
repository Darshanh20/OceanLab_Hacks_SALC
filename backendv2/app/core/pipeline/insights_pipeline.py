"""
Insights pipeline.

Generates keywords, questions, topics, and highlights.
"""

from app.services.ai.insights_service import generate_cached_insights


async def run_insights_pipeline(lecture_id: str, force_refresh: bool = False) -> dict:
    insights, cached = await generate_cached_insights(lecture_id, force_refresh=force_refresh)
    return {
        "lecture_id": lecture_id,
        "status": "insights_ready",
        "cached": cached,
        "insights": insights,
    }

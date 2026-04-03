"""
Action plan pipeline.

Generates cached lecture action plans from chunked transcripts.
"""

from app.services.ai.action_plan_service import generate_cached_action_plan


async def run_action_plan_pipeline(lecture_id: str, force_refresh: bool = False) -> dict:
    row, cached = await generate_cached_action_plan(lecture_id, force_refresh=force_refresh)
    return {
        "lecture_id": lecture_id,
        "status": "action_plan_ready",
        "cached": cached,
        "content": row.get("markdown_content") or "",
        "content_json": row.get("content_json") or {},
    }

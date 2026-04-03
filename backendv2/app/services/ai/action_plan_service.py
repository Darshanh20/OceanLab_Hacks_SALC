"""
Action plan service.

Generates lecture action plans from transcript chunks and caches them.
"""

from typing import Any, Dict, List, Tuple

from app.services.analysis_service import (
    aggregate_workspace_action_plan,
    build_action_plan_sections,
    generate_lecture_action_plan,
)
from app.services.ai.summary_service import generate_cached_summary
from app.services.db.lecture_repo import get_lecture
from app.services.group_service import GroupService
from app.services.supabase_client import get_supabase
from app.services.db.analysis_repo import get_analysis
from app.utils.chunking_utils import chunk_text_by_tokens


def _get_cached_action_plan(lecture_id: str) -> Dict[str, Any] | None:
    supabase = get_supabase()
    result = (
        supabase.table("lecture_action_plans")
        .select("*")
        .eq("lecture_id", lecture_id)
        .execute()
    )
    if result.data:
        return result.data[0]
    return None


def _share_team_ids_for_lecture(lecture_id: str) -> List[str]:
    supabase = get_supabase()
    result = (
        supabase.table("lecture_team_shares")
        .select("group_id")
        .eq("lecture_id", lecture_id)
        .execute()
    )
    return [row["group_id"] for row in (result.data or []) if row.get("group_id")]


async def generate_cached_action_plan(
    lecture_id: str,
    force_refresh: bool = False,
) -> Tuple[Dict[str, Any], bool]:
    """Generate or fetch a cached lecture action plan."""
    cached = _get_cached_action_plan(lecture_id)
    if cached and not force_refresh:
        return cached, True

    lecture = get_lecture(lecture_id)
    if not lecture or not lecture.get("transcript_text"):
        raise ValueError("Lecture not found or missing transcript_text")

    transcript = lecture["transcript_text"]
    summary = lecture.get("summary_text") or ""
    if not summary:
        summary, _ = await generate_cached_summary(lecture_id, force_refresh=False)

    highlights_row = get_analysis(lecture_id, "highlights")
    highlights = highlights_row["content"] if highlights_row and highlights_row.get("content") else ""

    workspace_teams: List[dict] = []
    org_id = lecture.get("org_id")
    if org_id:
        try:
            workspace_teams = await GroupService.get_groups_for_org(org_id)
        except Exception:
            workspace_teams = []

    chunks = chunk_text_by_tokens(transcript, max_tokens=700, overlap_tokens=100)
    if not chunks:
        chunks = [transcript]

    chunk_plans: List[Dict[str, Any]] = []
    chunk_markdowns: List[str] = []
    for chunk in chunks:
        markdown, content_json = await generate_lecture_action_plan(
            chunk,
            summary=summary,
            highlights=highlights,
            workspace_teams=workspace_teams,
        )
        chunk_plans.append(content_json)
        chunk_markdowns.append(markdown)

    if len(chunk_plans) == 1:
        markdown = chunk_markdowns[0]
        content_json = chunk_plans[0]
    else:
        markdown, content_json = aggregate_workspace_action_plan(chunk_plans)

    sections = build_action_plan_sections(content_json, markdown)
    share_team_ids = _share_team_ids_for_lecture(lecture_id)

    payload = {
        "lecture_id": lecture_id,
        "markdown_content": markdown,
        "content_json": content_json,
        "tasks_json": sections["tasks"]["content_json"],
        "timeline_json": sections["timeline"]["content_json"],
        "dependencies_json": sections["dependencies"]["content_json"],
        "team_breakdown_json": sections["team_breakdown"]["content_json"],
        "share_team_ids_json": share_team_ids,
        "is_shared": len(share_team_ids) > 0,
    }

    try:
        supabase = get_supabase()
        supabase.table("lecture_action_plans").upsert(payload, on_conflict="lecture_id").execute()
        latest = _get_cached_action_plan(lecture_id)
        if latest:
            return latest, False
    except Exception:
        pass

    return payload, False

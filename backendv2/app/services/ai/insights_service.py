"""
Insights service.

Generates and caches keywords, topics, questions, and highlights.
"""

import asyncio
from typing import Any, Dict, Tuple

from app.services.analysis_service import (
    detect_highlights,
    extract_keywords,
    safe_groq_call,
    segment_topics,
)
from app.services.db.analysis_repo import get_analysis, save_analysis
from app.services.db.lecture_repo import get_lecture
from app.utils.chunking_utils import chunk_text_by_tokens


INSIGHT_KEYS = ["keywords", "questions", "topics", "highlights"]


def _all_cached(lecture_id: str) -> Dict[str, Any]:
    cached: Dict[str, Any] = {}
    for key in INSIGHT_KEYS:
        row = get_analysis(lecture_id, key)
        if row and row.get("content"):
            cached[key] = row["content"]
    return cached


async def _merge_outputs(section_name: str, partials: list[str]) -> str:
    cleaned = [part.strip() for part in partials if part and part.strip()]
    if not cleaned:
        return ""
    if len(cleaned) == 1:
        return cleaned[0]

    system = "You consolidate chunk-level lecture analysis into one de-duplicated, well-structured markdown report."
    user = f"""Merge these {section_name} outputs into one final report.
Remove duplicates, keep the strongest items, and preserve markdown structure.

PARTIAL OUTPUTS:
{chr(10).join(['---' for _ in cleaned])}
{chr(10).join(cleaned)}
"""
    try:
        return await safe_groq_call(system, user, max_tokens=2048) or cleaned[0]
    except Exception:
        return "\n\n".join(cleaned)


async def _generate_compact_questions(chunk: str) -> str:
    system = "You generate short study questions and brief answers from lecture content. Keep the output compact and non-redundant."
    user = f"""Create 3 concise study questions from the lecture excerpt below.

Requirements:
- Include a short answer for each question.
- Keep each question specific and non-overlapping.
- Do not add long explanations.

LECTURE EXCERPT:
{chunk}
"""
    return await safe_groq_call(system, user, max_tokens=512) or ""


async def generate_cached_insights(
    lecture_id: str,
    force_refresh: bool = False,
) -> Tuple[Dict[str, str], bool]:
    """Generate or fetch cached lecture insights."""
    cached = _all_cached(lecture_id)
    if len(cached) == len(INSIGHT_KEYS) and not force_refresh:
        return cached, True

    lecture = get_lecture(lecture_id)
    if not lecture or not lecture.get("transcript_text"):
        raise ValueError("Lecture not found or missing transcript_text")

    transcript = lecture["transcript_text"]
    chunks = chunk_text_by_tokens(transcript, max_tokens=700, overlap_tokens=100)
    if not chunks:
        chunks = [transcript]

    keyword_partials: list[str] = []
    question_partials: list[str] = []
    topic_partials: list[str] = []
    highlight_partials: list[str] = []

    for chunk in chunks:
        k = await extract_keywords(chunk)
        q = await _generate_compact_questions(chunk)
        t = await segment_topics(chunk)
        h = await detect_highlights(chunk)
        keyword_partials.append(k or "")
        question_partials.append(q or "")
        topic_partials.append(t or "")
        highlight_partials.append(h or "")

    merged = {
        "keywords": await _merge_outputs("keywords", keyword_partials),
        "questions": await _merge_outputs("questions", question_partials),
        "topics": await _merge_outputs("topics", topic_partials),
        "highlights": await _merge_outputs("highlights", highlight_partials),
    }

    for key, value in merged.items():
        if value:
            try:
                save_analysis(lecture_id, key, value)
            except Exception:
                pass

    final = _all_cached(lecture_id)
    return final or merged, False

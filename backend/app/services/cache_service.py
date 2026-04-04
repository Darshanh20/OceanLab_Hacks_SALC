from typing import Awaitable, Callable, Any


ANALYSIS_TYPES = {
    "summary": "summary",
    "notes": "notes",
    "keywords": "keywords",
    "questions": "questions",
    "topics": "topics",
    "highlights": "highlights",
}


async def get_cached_analysis(supabase, lecture_id: str, analysis_type: str):
    print(f"[CACHE] Checking {analysis_type} for lecture {lecture_id}")
    try:
        res = (
            supabase.table("lecture_analysis")
            .select("content")
            .eq("lecture_id", lecture_id)
            .eq("analysis_type", analysis_type)
            .maybe_single()
            .execute()
        )
    except Exception as exc:
        print(f"[CACHE] Read failed for {analysis_type}: {exc}")
        return None

    if not res:
        return None

    data = getattr(res, "data", None)
    if isinstance(data, dict):
        return data.get("content")
    return None


async def store_analysis_cache(supabase, lecture_id: str, analysis_type: str, content: str):
    try:
        supabase.table("lecture_analysis").upsert(
            {
                "lecture_id": lecture_id,
                "analysis_type": analysis_type,
                "content": content,
            },
            on_conflict="lecture_id,analysis_type",
        ).execute()
    except Exception as exc:
        print(f"[CACHE] Write failed for {analysis_type}: {exc}")


async def get_or_generate_analysis(
    supabase,
    lecture_id: str,
    analysis_type: str,
    generator_func: Callable[..., Awaitable[str]],
    *args: Any,
    refresh: bool = False,
):
    # STEP 1: check cache
    if not refresh:
        cached = await get_cached_analysis(supabase, lecture_id, analysis_type)
        if cached:
            print(f"⚡ CACHE HIT: {analysis_type}")
            return cached

    print(f"🐢 CACHE MISS: {analysis_type}")

    # STEP 2: generate
    result = await generator_func(*args)

    # STEP 3: store
    if result:
        await store_analysis_cache(supabase, lecture_id, analysis_type, result)

    return result

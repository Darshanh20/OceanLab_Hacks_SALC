"""
Analysis repository.

Database operations for lecture_analysis table.
"""

from app.services.supabase_client import get_supabase
from typing import Dict, Any, Optional


def save_analysis(lecture_id: str, analysis_type: str, content: str) -> Dict[str, Any]:
    """Save or update lecture analysis."""
    supabase = get_supabase()
    
    # Try to insert, if it exists (unique constraint), update it instead
    response = supabase.table("lecture_analysis").upsert({
        "lecture_id": lecture_id,
        "analysis_type": analysis_type,
        "content": content
    }).execute()
    
    if response.data:
        return response.data[0]
    
    raise Exception("Failed to save analysis")


def get_analysis(lecture_id: str, analysis_type: str) -> Optional[Dict[str, Any]]:
    """Get specific analysis for a lecture."""
    supabase = get_supabase()
    
    response = supabase.table("lecture_analysis").select("*").eq(
        "lecture_id", lecture_id
    ).eq("analysis_type", analysis_type).execute()
    
    if response.data:
        return response.data[0]
    
    return None


def get_all_analyses(lecture_id: str) -> Dict[str, str]:
    """Get all analyses for a lecture as a dict."""
    supabase = get_supabase()
    
    response = supabase.table("lecture_analysis").select("*").eq("lecture_id", lecture_id).execute()
    
    # Convert to dict keyed by analysis_type
    result = {}
    for item in response.data or []:
        result[item["analysis_type"]] = item["content"]
    
    return result

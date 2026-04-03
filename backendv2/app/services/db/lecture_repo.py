"""
Lecture repository.

Database operations for lectures table.
"""

from app.services.supabase_client import get_supabase
from typing import Dict, Any, Optional


def create_lecture(lecture_data: Dict[str, Any]) -> Dict[str, Any]:
    """Create a new lecture record."""
    supabase = get_supabase()
    
    response = supabase.table("lectures").insert(lecture_data).execute()
    
    if response.data:
        return response.data[0]
    
    raise Exception("Failed to create lecture")


def get_lecture(lecture_id: str) -> Optional[Dict[str, Any]]:
    """Get lecture by ID."""
    supabase = get_supabase()
    
    response = supabase.table("lectures").select("*").eq("id", lecture_id).execute()
    
    if response.data:
        return response.data[0]
    
    return None


def update_lecture(lecture_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    """Update lecture record."""
    supabase = get_supabase()
    
    response = supabase.table("lectures").update(updates).eq("id", lecture_id).execute()
    
    if response.data:
        return response.data[0]
    
    raise Exception("Failed to update lecture")


def update_lecture_status(lecture_id: str, status: str) -> Dict[str, Any]:
    """Update lecture status."""
    return update_lecture(lecture_id, {"status": status})


def delete_lecture(lecture_id: str) -> bool:
    """Delete lecture record."""
    supabase = get_supabase()
    
    response = supabase.table("lectures").delete().eq("id", lecture_id).execute()
    
    return True

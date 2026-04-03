"""
Chunk repository.

Database operations for lecture_chunks table.
"""

from app.services.supabase_client import get_supabase
from typing import List, Dict, Any


def insert_chunks(chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Insert lecture chunks with embeddings."""
    supabase = get_supabase()
    
    response = supabase.table("lecture_chunks").insert(chunks).execute()
    
    if response.data:
        return response.data
    
    raise Exception("Failed to insert chunks")


def get_chunks_for_lecture(lecture_id: str) -> List[Dict[str, Any]]:
    """Get all chunks for a lecture."""
    supabase = get_supabase()
    
    response = supabase.table("lecture_chunks").select("*").eq("lecture_id", lecture_id).execute()
    
    return response.data or []


def search_similar_chunks(lecture_id: str, query_embedding: List[float], limit: int = 5) -> List[Dict[str, Any]]:
    """
    Search for similar chunks using RPC function.
    
    Uses pgvector cosine similarity.
    """
    supabase = get_supabase()
    
    response = supabase.rpc(
        "match_lecture_chunks",
        {
            "query_embedding": query_embedding,
            "match_lecture_id": lecture_id,
            "match_count": limit
        }
    ).execute()
    
    return response.data or []

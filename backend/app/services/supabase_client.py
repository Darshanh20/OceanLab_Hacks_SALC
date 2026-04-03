from supabase import create_client, Client
from typing import Optional
from app.config import SUPABASE_URL, SUPABASE_KEY

_client: Optional[Client] = None


def get_supabase() -> Client:
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_KEY must be set in environment variables"
            )
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client

import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt, JWTError
from app.config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRATION_HOURS
from app.services.supabase_client import get_supabase


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None


async def create_user(email: str, password: str) -> dict:
    supabase = get_supabase()
    password_hash = hash_password(password)
    result = (
        supabase.table("users")
        .insert({"email": email, "password_hash": password_hash})
        .execute()
    )
    if not result.data:
        raise ValueError("Failed to create user")
    return result.data[0]


async def authenticate_user(email: str, password: str) -> Optional[dict]:
    supabase = get_supabase()
    result = (
        supabase.table("users")
        .select("*")
        .eq("email", email)
        .execute()
    )
    if not result.data:
        return None
    user = result.data[0]
    if not verify_password(password, user["password_hash"]):
        return None
    return user


async def get_user_by_id(user_id: str) -> Optional[dict]:
    supabase = get_supabase()
    result = (
        supabase.table("users")
        .select("id, email, created_at")
        .eq("id", user_id)
        .execute()
    )
    if not result.data:
        return None
    return result.data[0]

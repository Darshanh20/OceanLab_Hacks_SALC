from pydantic import BaseModel
from typing import Optional


# ── Auth ──

class UserCreate(BaseModel):
    email: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str


class UserResponse(BaseModel):
    id: str
    email: str
    created_at: Optional[str] = None


# ── Lectures ──

class LectureResponse(BaseModel):
    id: str
    user_id: str
    title: str
    audio_url: Optional[str] = None
    transcript_text: Optional[str] = None
    transcript_json: Optional[str] = None
    summary_text: Optional[str] = None
    status: str
    org_id: Optional[str] = None
    group_id: Optional[str] = None
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


class LectureListResponse(BaseModel):
    lectures: list[LectureResponse]


class MessageResponse(BaseModel):
    message: str


# ── Chat ──

class ChatRequest(BaseModel):
    question: str


class ChatResponse(BaseModel):
    answer: str
    sources: list[str] = []


# ── Team Sharing ──

class TeamShareRequest(BaseModel):
    team_ids: list[str]

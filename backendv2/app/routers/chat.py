from fastapi import APIRouter, Depends, HTTPException, status
from app.models.schemas import ChatRequest, ChatResponse, ChatQueryRequest
from app.middleware.auth_middleware import get_current_user
from app.services.supabase_client import get_supabase
from app.services.rag_service import answer_question
from app.services.ai.chat_service import answer_lecture_question
from app.services.organization_service import OrganizationService
from app.services.group_service import GroupService

router = APIRouter(prefix="/api/lectures", tags=["Chat"])
query_router = APIRouter(prefix="/api/chat", tags=["Chat"])


async def _can_access_lecture(lecture: dict, user_id: str) -> bool:
    """
    Access model:
    - Personal lecture (no org_id): only uploader can access.
    - Workspace lecture (org_id, no group_id): any workspace member can access.
    - Team lecture (org_id + group_id): team members, org admins, and org owner can access.
    """
    owner_id = lecture.get("user_id")
    org_id = lecture.get("org_id")
    group_id = lecture.get("group_id")

    # Personal content remains private to creator.
    if not org_id:
        return owner_id == user_id

    org_role = await OrganizationService.get_role(org_id, user_id)
    if not org_role:
        return False

    # Workspace-wide lecture is visible to all workspace members.
    if not group_id:
        return True

    # Org owner/admin can always access team lectures.
    if org_role in ["owner", "admin"]:
        return True

    # Members need explicit team membership for team-scoped lectures.
    group_role = await GroupService.get_group_role(group_id, user_id)
    return bool(group_role)


@router.post("/{lecture_id}/chat", response_model=ChatResponse)
async def chat_with_lecture(
    lecture_id: str,
    data: ChatRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    RAG-based Q&A endpoint.
    Takes a question about a lecture and returns a contextual answer.
    """
    supabase = get_supabase()

    # Get lecture and verify access
    result = (
        supabase.table("lectures")
        .select("id, status, org_id, group_id, user_id")
        .eq("id", lecture_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lecture not found",
        )

    lecture = result.data[0]
    can_access = await _can_access_lecture(lecture, current_user["user_id"])
    if not can_access:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lecture not found",
        )

    if lecture["status"] != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Lecture is still being processed (status: {lecture['status']}). Please wait until processing is complete.",
        )

    if not data.question.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question cannot be empty",
        )

    try:
        answer, sources = await answer_lecture_question(lecture_id, data.question)
        return ChatResponse(answer=answer, sources=sources)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate answer: {str(e)}",
        )


@query_router.post("/query", response_model=ChatResponse)
async def query_chat(
    data: ChatQueryRequest,
    current_user: dict = Depends(get_current_user),
):
    """RAG-based Q&A endpoint using the explicit /api/chat/query route."""
    supabase = get_supabase()

    result = (
        supabase.table("lectures")
        .select("id, status, org_id, group_id, user_id")
        .eq("id", data.lecture_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lecture not found")

    lecture = result.data[0]
    can_access = await _can_access_lecture(lecture, current_user["user_id"])
    if not can_access:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lecture not found")

    if lecture["status"] != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Lecture is still being processed (status: {lecture['status']}). Please wait until processing is complete.",
        )

    if not data.question.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Question cannot be empty")

    try:
        answer, sources = await answer_lecture_question(data.lecture_id, data.question)
        return ChatResponse(answer=answer, sources=sources)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate answer: {str(e)}",
        )

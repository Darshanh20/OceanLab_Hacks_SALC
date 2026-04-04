from fastapi import APIRouter, HTTPException, Depends
from typing import List, Literal
from app.middleware.auth_middleware import get_current_user
from app.services.organization_service import OrganizationService
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/organizations", tags=["Organizations"])

class CreateOrgRequest(BaseModel):
    name: str

class InviteMemberRequest(BaseModel):
    email: str
    role: Literal["admin", "member"] = "member"

@router.post("", response_model=dict)
async def create_organization(req: CreateOrgRequest, current_user: dict = Depends(get_current_user)):
    try:
        return await OrganizationService.create_organization(req.name, current_user["user_id"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("", response_model=List[dict])
async def list_organizations(current_user: dict = Depends(get_current_user)):
    return await OrganizationService.get_organizations_for_user(current_user["user_id"])

@router.get("/pending-invitations", response_model=dict)
async def get_pending_invitations(current_user: dict = Depends(get_current_user)):
    """Get pending workspace invitations for current user"""
    invitations = await OrganizationService.get_pending_invitations_by_email(current_user["email"])
    return {"pending_invitations": invitations}

@router.get("/{org_id}/members", response_model=List[dict])
async def list_members(org_id: str, current_user: dict = Depends(get_current_user)):
    role = await OrganizationService.get_role(org_id, current_user["user_id"])
    if not role:
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    
    return await OrganizationService.get_organization_members(org_id)

@router.get("/{org_id}/role", response_model=dict)
async def get_my_org_role(org_id: str, current_user: dict = Depends(get_current_user)):
    role = await OrganizationService.get_role(org_id, current_user["user_id"])
    if not role:
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    return {"role": role}

@router.get("/{org_id}/invites", response_model=dict)
async def get_invites(org_id: str, current_user: dict = Depends(get_current_user)):
    role = await OrganizationService.get_role(org_id, current_user["user_id"])
    if role != "owner":
        raise HTTPException(status_code=403, detail="Only workspace owner can view invitations")
    
    pending = await OrganizationService.get_pending_invites(org_id)
    return {"pending_invites": pending}

@router.post("/{org_id}/invite", response_model=dict)
async def invite_member(org_id: str, req: InviteMemberRequest, current_user: dict = Depends(get_current_user)):
    role = await OrganizationService.get_role(org_id, current_user["user_id"])
    if role != "owner":
        raise HTTPException(status_code=403, detail="Only workspace owner can invite members")
    
    try:
        result = await OrganizationService.invite_member(org_id, req.email, req.role, inviter_user_id=current_user["user_id"])
        
        # Handle different response statuses
        if result.get("status") == "already_member":
            raise HTTPException(status_code=409, detail=f"User is already a member of this workspace with role: {result.get('role')}")
        elif result.get("status") == "already_invited":
            invite_status = result.get("invite_status")
            raise HTTPException(status_code=409, detail=f"Invitation already sent to this user. Current status: {invite_status}")
        
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/invite/accept")
async def accept_invite(token: str):
    """
    Accept a workspace invitation via token.
    This endpoint accepts an invitation token from email and:
    1. Validates the token exists and is pending
    2. Updates status to accepted
    3. Adds user to org_members
    4. Returns success JSON
    """
    logger.info(f"[ACCEPT_INVITE] Received token: {token}")
    
    if not token:
        logger.error("[ACCEPT_INVITE] No token provided")
        raise HTTPException(status_code=400, detail="Token is required")
    
    try:
        logger.info(f"[ACCEPT_INVITE] Looking up token in database...")
        result = await OrganizationService.accept_invite(token)
        logger.info(f"[ACCEPT_INVITE] Successfully accepted invite: {result}")
        return {
            "status": "success", 
            "org_name": result.get("org_name"), 
            "org_id": result.get("org_id"), 
            "role": result.get("role")
        }
    except ValueError as e:
        error_msg = str(e)
        logger.error(f"[ACCEPT_INVITE] Error accepting invite: {error_msg}")
        raise HTTPException(status_code=400, detail=error_msg)
    except Exception as e:
        error_msg = f"Unexpected error: {str(e)}"
        logger.error(f"[ACCEPT_INVITE] Unexpected error: {error_msg}", exc_info=True)
        raise HTTPException(status_code=500, detail=error_msg)

@router.delete("/{org_id}/members/{user_id}", response_model=dict)
async def remove_member(org_id: str, user_id: str, current_user: dict = Depends(get_current_user)):
    actor_role = await OrganizationService.get_role(org_id, current_user["user_id"])
    if actor_role != "owner":
        raise HTTPException(status_code=403, detail="Only workspace owner can remove members")

    target_role = await OrganizationService.get_role(org_id, user_id)
    if not target_role:
        raise HTTPException(status_code=404, detail="Target user is not a workspace member")

    if target_role == "owner":
        raise HTTPException(status_code=403, detail="Owner cannot be removed")

    await OrganizationService.remove_member(org_id, user_id)
    return {"message": "Member removed successfully"}


@router.delete("/{org_id}", response_model=dict)
async def delete_organization(org_id: str, current_user: dict = Depends(get_current_user)):
    role = await OrganizationService.get_role(org_id, current_user["user_id"])
    if role != "owner":
        raise HTTPException(status_code=403, detail="Only workspace owner can delete this workspace")

    try:
        await OrganizationService.delete_organization(org_id)
        return {"message": "Workspace deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

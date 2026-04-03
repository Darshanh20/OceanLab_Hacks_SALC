from fastapi import APIRouter, HTTPException, Depends
from typing import List, Literal
from app.middleware.auth_middleware import get_current_user
from app.services.organization_service import OrganizationService
from pydantic import BaseModel

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

@router.post("/{org_id}/invite", response_model=dict)
async def invite_member(org_id: str, req: InviteMemberRequest, current_user: dict = Depends(get_current_user)):
    role = await OrganizationService.get_role(org_id, current_user["user_id"])
    if role != "owner":
        raise HTTPException(status_code=403, detail="Only workspace owner can invite members")
    
    try:
        return await OrganizationService.invite_member(org_id, req.email, req.role)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

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

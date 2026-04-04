from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional, Literal
from app.middleware.auth_middleware import get_current_user
from app.services.group_service import GroupService
from app.services.organization_service import OrganizationService
from app.services.supabase_client import get_supabase
from pydantic import BaseModel

router = APIRouter(prefix="/api/groups", tags=["Groups"])

class CreateGroupRequest(BaseModel):
    org_id: str
    name: str
    description: Optional[str] = None

class AddGroupMemberRequest(BaseModel):
    user_id: str
    role: Literal["admin", "member"] = "member"

@router.post("", response_model=dict)
async def create_group(req: CreateGroupRequest, current_user: dict = Depends(get_current_user)):
    org_role = await OrganizationService.get_role(req.org_id, current_user["user_id"])
    if org_role != "owner":
        raise HTTPException(status_code=403, detail="Only workspace owner can create teams")
    
    try:
        return await GroupService.create_group(req.org_id, req.name, req.description, current_user["user_id"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/org/{org_id}", response_model=List[dict])
async def list_groups(org_id: str, current_user: dict = Depends(get_current_user)):
    org_role = await OrganizationService.get_role(org_id, current_user["user_id"])
    if not org_role:
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    
    # Owners can view all teams. Admin/member only see teams they are part of.
    if org_role == "owner":
        return await GroupService.get_groups_for_org(org_id)
    else:
        return await GroupService.get_groups_for_user(org_id, current_user["user_id"])

@router.get("/{group_id}", response_model=dict)
async def get_group(group_id: str, current_user: dict = Depends(get_current_user)):
    group = await GroupService.get_group_by_id(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    org_role = await OrganizationService.get_role(group["org_id"], current_user["user_id"])
    if not org_role:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    group_role = await GroupService.get_group_role(group_id, current_user["user_id"])
    if org_role != "owner" and not group_role:
        raise HTTPException(status_code=403, detail="Not authorized to view this team")

    can_manage_members = (group_role == "admin") or (org_role == "owner")

    group["my_org_role"] = org_role
    group["my_group_role"] = group_role
    group["can_manage_members"] = can_manage_members
    return group

@router.get("/{group_id}/members", response_model=List[dict])
async def list_group_members(group_id: str, current_user: dict = Depends(get_current_user)):
    group = await GroupService.get_group_by_id(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    org_role = await OrganizationService.get_role(group["org_id"], current_user["user_id"])
    if not org_role:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    group_role = await GroupService.get_group_role(group_id, current_user["user_id"])
    if org_role != "owner" and not group_role:
        raise HTTPException(status_code=403, detail="Not authorized to view this team")

    return await GroupService.get_group_members(group_id)

@router.post("/{group_id}/members", response_model=dict)
async def add_member(group_id: str, req: AddGroupMemberRequest, current_user: dict = Depends(get_current_user)):
    # Only workspace owner or group admin can add members.
    group_role = await GroupService.get_group_role(group_id, current_user["user_id"])
    supabase = get_supabase()
    group_data = supabase.table("groups").select("org_id").eq("id", group_id).single().execute()
    org_id = group_data.data["org_id"]
    org_role = await OrganizationService.get_role(org_id, current_user["user_id"])
    
    if org_role != "owner" and group_role != "admin":
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    target_org_role = await OrganizationService.get_role(org_id, req.user_id)

    # Non-owners cannot assign admin role or manage org-level privileged users.
    if org_role != "owner":
        if req.role == "admin":
            raise HTTPException(status_code=403, detail="Only workspace owner can assign team admin role")
        if target_org_role in ["owner", "admin"]:
            raise HTTPException(status_code=403, detail="Only workspace owner can add org owner/admin to a team")

    assigned_role = "admin" if target_org_role in ["owner", "admin"] else req.role
    
    try:
        # Get member email for notification
        user_result = supabase.table("users").select("email").eq("id", req.user_id).execute()
        notify_email = user_result.data[0].get("email") if user_result.data else None
        
        return await GroupService.add_group_member(group_id, req.user_id, assigned_role, notify_email=notify_email)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{group_id}/members/{user_id}", response_model=dict)
async def remove_member(group_id: str, user_id: str, current_user: dict = Depends(get_current_user)):
    group_role = await GroupService.get_group_role(group_id, current_user["user_id"])
    supabase = get_supabase()
    group_data = supabase.table("groups").select("org_id").eq("id", group_id).single().execute()
    org_id = group_data.data["org_id"]
    org_role = await OrganizationService.get_role(org_id, current_user["user_id"])
    
    if org_role != "owner" and group_role != "admin":
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    target_org_role = await OrganizationService.get_role(org_id, user_id)
    if target_org_role in ["owner", "admin"]:
        raise HTTPException(
            status_code=403,
            detail="Organization owners/admins cannot be removed from group-level admin access",
        )

    target_group_role = await GroupService.get_group_role(group_id, user_id)
    if org_role != "owner" and target_group_role == "admin":
        raise HTTPException(status_code=403, detail="Only workspace owner can remove team admins")
    
    await GroupService.remove_group_member(group_id, user_id)
    return {"message": "Member removed successfully"}

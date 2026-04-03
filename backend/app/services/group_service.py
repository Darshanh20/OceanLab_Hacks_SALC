from typing import List, Optional
from app.services.supabase_client import get_supabase

class GroupService:
    @staticmethod
    async def get_group_by_id(group_id: str) -> Optional[dict]:
        supabase = get_supabase()
        result = (
            supabase.table("groups")
            .select("*")
            .eq("id", group_id)
            .execute()
        )
        if not result.data:
            return None
        return result.data[0]

    @staticmethod
    async def get_group_members(group_id: str) -> List[dict]:
        supabase = get_supabase()
        result = (
            supabase.table("group_members")
            .select("id, user_id, role, joined_at, users(email)")
            .eq("group_id", group_id)
            .execute()
        )
        return result.data or []

    @staticmethod
    async def create_group(org_id: str, name: str, description: Optional[str], created_by: str) -> dict:
        supabase = get_supabase()
        result = supabase.table("groups").insert({
            "org_id": org_id,
            "name": name,
            "description": description,
            "created_by": created_by
        }).execute()
        
        if not result.data:
            raise ValueError("Failed to create group")
        
        group = result.data[0]
        
        # Add creator as admin member
        supabase.table("group_members").insert({
            "group_id": group["id"],
            "user_id": created_by,
            "role": "admin"
        }).execute()
        
        return group

    @staticmethod
    async def get_groups_for_org(org_id: str) -> List[dict]:
        supabase = get_supabase()
        result = supabase.table("groups") \
            .select("*") \
            .eq("org_id", org_id) \
            .execute()
        return result.data

    @staticmethod
    async def get_groups_for_user(org_id: str, user_id: str) -> List[dict]:
        supabase = get_supabase()
        result = supabase.table("group_members") \
            .select("groups(*)") \
            .eq("user_id", user_id) \
            .execute()
        
        return [item["groups"] for item in result.data if item.get("groups") and item["groups"]["org_id"] == org_id]

    @staticmethod
    async def add_group_member(group_id: str, user_id: str, role: str = "member") -> dict:
        supabase = get_supabase()

        group_result = (
            supabase.table("groups")
            .select("org_id")
            .eq("id", group_id)
            .single()
            .execute()
        )
        if not group_result.data:
            raise ValueError("Group not found")

        org_id = group_result.data["org_id"]

        # If user is not yet an org member, add them as org member first.
        org_member = (
            supabase.table("org_members")
            .select("id, role")
            .eq("org_id", org_id)
            .eq("user_id", user_id)
            .execute()
        )
        if org_member.data and org_member.data[0].get("role") in ["owner", "admin"]:
            # Org owner/admin always get admin permissions at the group level.
            role = "admin"

        if not org_member.data:
            supabase.table("org_members").insert({
                "org_id": org_id,
                "user_id": user_id,
                "role": "member",
            }).execute()

        existing_group_member = (
            supabase.table("group_members")
            .select("id")
            .eq("group_id", group_id)
            .eq("user_id", user_id)
            .execute()
        )
        if existing_group_member.data:
            raise ValueError("User is already a member of this group")

        result = supabase.table("group_members").insert({
            "group_id": group_id,
            "user_id": user_id,
            "role": role
        }).execute()
        
        if not result.data:
            raise ValueError("Failed to add member to group")
            
        return result.data[0]

    @staticmethod
    async def remove_group_member(group_id: str, user_id: str):
        supabase = get_supabase()
        supabase.table("group_members").delete() \
            .eq("group_id", group_id) \
            .eq("user_id", user_id) \
            .execute()

    @staticmethod
    async def get_group_role(group_id: str, user_id: str) -> Optional[str]:
        supabase = get_supabase()
        result = supabase.table("group_members") \
            .select("role") \
            .eq("group_id", group_id) \
            .eq("user_id", user_id) \
            .execute()
        
        if not result.data:
            return None
        return result.data[0]["role"]

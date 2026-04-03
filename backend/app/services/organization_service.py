from typing import List, Optional
from datetime import datetime
from app.services.supabase_client import get_supabase

class OrganizationService:
    @staticmethod
    async def create_organization(name: str, owner_id: str) -> dict:
        supabase = get_supabase()
        
        # Insert organization
        org_result = supabase.table("organizations").insert({
            "name": name,
            "owner_id": owner_id,
            "subscription_tier": "free",
            "subscription_status": "active"
        }).execute()
        
        if not org_result.data:
            raise ValueError("Failed to create organization")
        
        org = org_result.data[0]
        
        # Add owner as admin member
        supabase.table("org_members").insert({
            "org_id": org["id"],
            "user_id": owner_id,
            "role": "owner"
        }).execute()
        
        return org

    @staticmethod
    async def get_organizations_for_user(user_id: str) -> List[dict]:
        supabase = get_supabase()
        result = supabase.table("org_members") \
            .select("role, organizations(*)") \
            .eq("user_id", user_id) \
            .execute()

        organizations = []
        for item in result.data or []:
            org = item.get("organizations")
            if org:
                org["my_role"] = item.get("role")
                organizations.append(org)

        return organizations

    @staticmethod
    async def get_organization_members(org_id: str) -> List[dict]:
        supabase = get_supabase()
        # Fetch org_members
        result = supabase.table("org_members") \
            .select("id, org_id, user_id, role, joined_at") \
            .eq("org_id", org_id) \
            .execute()

        members = result.data or []
        
        # Fetch user emails for all member user_ids
        user_ids = [m.get("user_id") for m in members if m.get("user_id")]
        users_map = {}
        if user_ids:
            users_result = supabase.table("users") \
                .select("id, email") \
                .in_("id", user_ids) \
                .execute()
            for user in users_result.data or []:
                users_map[user.get("id")] = user
        
        # Add users data to members
        for member in members:
            user_id = member.get("user_id")
            member["users"] = users_map.get(user_id, {})

        groups_result = (
            supabase.table("groups")
            .select("id, name")
            .eq("org_id", org_id)
            .execute()
        )
        groups = groups_result.data or []
        group_ids = [g["id"] for g in groups]
        group_name_by_id = {g["id"]: g["name"] for g in groups}

        memberships_by_user: dict[str, list[dict]] = {}
        if group_ids:
            group_members_result = (
                supabase.table("group_members")
                .select("user_id, group_id, role")
                .in_("group_id", group_ids)
                .execute()
            )
            for gm in group_members_result.data or []:
                user_id = gm.get("user_id")
                if not user_id:
                    continue
                memberships_by_user.setdefault(user_id, []).append({
                    "group_id": gm.get("group_id"),
                    "group_name": group_name_by_id.get(gm.get("group_id"), "Unknown Group"),
                    "role": gm.get("role", "member"),
                })

        for member in members:
            member["groups"] = memberships_by_user.get(member.get("user_id"), [])

        return members

    @staticmethod
    async def invite_member(org_id: str, email: str, role: str = "member") -> dict:
        supabase = get_supabase()

        if role not in ["admin", "member"]:
            raise ValueError("Invalid role. Allowed roles: admin, member")
        
        # Find user by email
        user_result = supabase.table("users").select("id").eq("email", email).execute()
        if not user_result.data:
            raise ValueError("User not found")
        
        user_id = user_result.data[0]["id"]

        # If already in workspace, update role (owner can promote member -> admin).
        existing = (
            supabase.table("org_members")
            .select("id, role")
            .eq("org_id", org_id)
            .eq("user_id", user_id)
            .execute()
        )

        if existing.data:
            current_role = existing.data[0].get("role")
            if current_role == "owner":
                raise ValueError("Cannot change owner role")

            updated = (
                supabase.table("org_members")
                .update({"role": role})
                .eq("org_id", org_id)
                .eq("user_id", user_id)
                .execute()
            )
            if not updated.data:
                raise ValueError("Failed to update member role")
            return updated.data[0]
        
        # Add to organization
        result = supabase.table("org_members").insert({
            "org_id": org_id,
            "user_id": user_id,
            "role": role
        }).execute()
        
        if not result.data:
            raise ValueError("Failed to add member to organization")
            
        return result.data[0]

    @staticmethod
    async def remove_member(org_id: str, user_id: str):
        supabase = get_supabase()
        supabase.table("org_members").delete().eq("org_id", org_id).eq("user_id", user_id).execute()

    @staticmethod
    async def delete_organization(org_id: str):
        supabase = get_supabase()
        result = supabase.table("organizations").delete().eq("id", org_id).execute()
        if not result.data:
            raise ValueError("Workspace not found or failed to delete")

    @staticmethod
    async def get_role(org_id: str, user_id: str) -> Optional[str]:
        supabase = get_supabase()
        result = supabase.table("org_members") \
            .select("role") \
            .eq("org_id", org_id) \
            .eq("user_id", user_id) \
            .execute()
        
        if not result.data:
            return None
        return result.data[0]["role"]

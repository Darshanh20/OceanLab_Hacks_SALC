from typing import List, Optional
from datetime import datetime
from app.services.supabase_client import get_supabase
from app.services.email_service import send_workspace_invite_email
import logging

logger = logging.getLogger(__name__)

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
    async def get_pending_invites(org_id: str) -> List[dict]:
        """Get all pending workspace invites for an organization"""
        supabase = get_supabase()
        result = supabase.table("workspace_invites") \
            .select("id, email, role, status, invited_at") \
            .eq("org_id", org_id) \
            .eq("status", "pending") \
            .execute()
        return result.data or []

    @staticmethod
    async def invite_member(org_id: str, email: str, role: str = "member", inviter_user_id: str = None) -> dict:
        """Create a pending workspace invite (does not add member directly)"""
        supabase = get_supabase()

        if role not in ["admin", "member"]:
            raise ValueError("Invalid role. Allowed roles: admin, member")
        
        # Find user by email
        user_result = supabase.table("users").select("id, email").eq("email", email).execute()
        if not user_result.data:
            raise ValueError("User not found")
        
        user = user_result.data[0]
        user_id = user.get("id")
        member_email = user.get("email")

        # Get organization name
        org_result = supabase.table("organizations").select("name").eq("id", org_id).execute()
        org_name = org_result.data[0].get("name") if org_result.data else "Workspace"

        # Get inviter name
        inviter_name = "Admin"
        if inviter_user_id:
            inviter_result = supabase.table("users").select("email").eq("id", inviter_user_id).execute()
            if inviter_result.data:
                inviter_name = inviter_result.data[0].get("email", "Admin")

        # Check if already a member
        existing_member = (
            supabase.table("org_members")
            .select("id, role")
            .eq("org_id", org_id)
            .eq("user_id", user_id)
            .execute()
        )

        if existing_member.data:
            # Already a member - just return their status
            return {
                "status": "already_member",
                "role": existing_member.data[0].get("role"),
                "email_sent": False
            }

        # Check if already invited (pending or accepted)
        existing_invite = (
            supabase.table("workspace_invites")
            .select("id, status")
            .eq("org_id", org_id)
            .eq("user_id", user_id)
            .in_("status", ["pending", "accepted"])
            .execute()
        )

        if existing_invite.data:
            # Already invited - return existing status
            invite_status = existing_invite.data[0].get("status")
            return {
                "status": "already_invited",
                "invite_status": invite_status,
                "email_sent": False
            }

        # Create pending invite with unique token
        invite_result = supabase.table("workspace_invites").insert({
            "org_id": org_id,
            "user_id": user_id,
            "email": member_email,
            "role": role,
            "status": "pending"
        }).execute()
        
        if not invite_result.data:
            raise ValueError("Failed to create invitation")
        
        invite = invite_result.data[0]
        invite_token = invite.get("invite_token")
        
        # Send invite email
        email_sent = send_workspace_invite_email(
            to_email=member_email,
            member_name=email.split("@")[0],
            workspace_name=org_name,
            inviter_name=inviter_name,
            invite_token=invite_token
        )
        
        return {
            "status": "pending",
            "invite_token": invite_token,
            "email_sent": email_sent
        }

    @staticmethod
    async def accept_invite(invite_token: str) -> dict:
        """Accept a pending workspace invite"""
        supabase = get_supabase()
        
        logger.info(f"[ACCEPT_INVITE] Starting. Token: {invite_token}")
        
        # Find invite by token
        logger.info(f"[ACCEPT_INVITE] Querying workspace_invites table for token={invite_token}")
        invite_result = supabase.table("workspace_invites") \
            .select("id, org_id, user_id, email, role, status, invite_token") \
            .eq("invite_token", invite_token) \
            .execute()
        
        logger.info(f"[ACCEPT_INVITE] Query result data: {invite_result.data}")
        logger.info(f"[ACCEPT_INVITE] Query result error: {invite_result}")
        
        if not invite_result.data:
            logger.error(f"[ACCEPT_INVITE] No invite found for token: {invite_token}")
            raise ValueError("Invalid or expired invitation token")
        
        invite = invite_result.data[0]
        logger.info(f"[ACCEPT_INVITE] Found invite: {invite}")
        
        if invite.get("status") != "pending":
            logger.warning(f"[ACCEPT_INVITE] Invite status is not pending: {invite.get('status')}")
            raise ValueError(f"Invitation has already been {invite.get('status')}")
        
        # Update invite status
        logger.info(f"[ACCEPT_INVITE] Updating invite status to accepted")
        supabase.table("workspace_invites") \
            .update({"status": "accepted", "accepted_at": datetime.utcnow().isoformat()}) \
            .eq("invite_token", invite_token) \
            .execute()
        
        # Add user as org member
        org_id = invite.get("org_id")
        user_id = invite.get("user_id")
        role = invite.get("role")
        
        logger.info(f"[ACCEPT_INVITE] Adding user {user_id} to org_members for org {org_id} with role {role}")
        supabase.table("org_members").insert({
            "org_id": org_id,
            "user_id": user_id,
            "role": role
        }).execute()
        
        # Get organization name
        org_result = supabase.table("organizations").select("name").eq("id", org_id).execute()
        org_name = org_result.data[0].get("name") if org_result.data else "Workspace"
        
        logger.info(f"[ACCEPT_INVITE] Success! User accepted invite for workspace: {org_name}")
        return {
            "status": "accepted",
            "org_name": org_name,
            "org_id": org_id,
            "role": role
        }

    @staticmethod
    async def get_invite_status(org_id: str, user_id: str) -> Optional[str]:
        """Get invitation status for a user (pending, accepted, rejected, or None)"""
        supabase = get_supabase()
        result = supabase.table("workspace_invites") \
            .select("status") \
            .eq("org_id", org_id) \
            .eq("user_id", user_id) \
            .order("invited_at", desc=True) \
            .limit(1) \
            .execute()
        
        if not result.data:
            return None
        return result.data[0].get("status")

    @staticmethod
    async def get_pending_invitations_by_email(email: str) -> List[dict]:
        """Get all pending workspace invitations for a user by email"""
        supabase = get_supabase()
        result = supabase.table("workspace_invites") \
            .select("id, invite_token, org_id, role, invited_at, organizations(name)") \
            .eq("email", email) \
            .eq("status", "pending") \
            .order("invited_at", desc=True) \
            .execute()
        
        invitations = []
        for item in result.data or []:
            org = item.get("organizations")
            invitations.append({
                "id": item.get("id"),
                "invite_token": item.get("invite_token"),
                "org_id": item.get("org_id"),
                "org_name": org.get("name") if org else "Unknown Workspace",
                "role": item.get("role"),
                "invited_at": item.get("invited_at")
            })
        
        return invitations

    @staticmethod
    async def remove_member(org_id: str, user_id: str):
        """Remove member from workspace and all teams in that workspace"""
        supabase = get_supabase()
        
        # Get all groups in this organization
        groups_result = supabase.table("groups").select("id").eq("org_id", org_id).execute()
        group_ids = [g["id"] for g in groups_result.data or []]
        
        # Remove user from all groups in this organization
        if group_ids:
            supabase.table("group_members").delete().in_("group_id", group_ids).eq("user_id", user_id).execute()
        
        # Remove user from organization
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

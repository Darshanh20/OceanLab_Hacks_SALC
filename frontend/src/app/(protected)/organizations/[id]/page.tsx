"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Users, UserPlus, Trash2, ArrowLeft, Shield, Mail, Plus, ArrowRight, Search, Upload, MessageSquare } from "lucide-react";
import Link from "next/link";
import { organizationsAPI, groupsAPI } from "@/lib/api";

interface Member {
    id: string;
    user_id: string;
    role: string;
    joined_at: string;
    groups?: Array<{
        group_id: string;
        group_name: string;
        role: string;
    }>;
    users: {
        email: string;
    };
}

interface Team {
    id: string;
    name: string;
    description?: string;
    created_at: string;
}

export default function OrganizationSettingsPage() {
    const params = useParams();
    const orgId = params.id as string;
    
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState("member");
    const [inviting, setInviting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [myRole, setMyRole] = useState<string | null>(null);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [teams, setTeams] = useState<Team[]>([]);
    const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
    const [newTeamName, setNewTeamName] = useState("");
    const [newTeamDescription, setNewTeamDescription] = useState("");
    const [creatingTeam, setCreatingTeam] = useState(false);
    const [removingUserId, setRemovingUserId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"members" | "teams">("members");
    const [memberSearch, setMemberSearch] = useState("");
    const [teamSearch, setTeamSearch] = useState("");
    const [membersVisibleCount, setMembersVisibleCount] = useState(12);
    const [teamsVisibleCount, setTeamsVisibleCount] = useState(8);

    const canManageMembers = myRole === "owner" || myRole === "admin";
    const canRemoveMember = (role: string) => {
        if (myRole === "owner") return role !== "owner";
        if (myRole === "admin") return role === "member";
        return false;
    };

    const filteredMembers = members.filter((member) => {
        if (!memberSearch.trim()) return true;
        return member.users.email.toLowerCase().includes(memberSearch.trim().toLowerCase());
    });

    const filteredTeams = teams.filter((team) => {
        if (!teamSearch.trim()) return true;
        const q = teamSearch.trim().toLowerCase();
        return team.name.toLowerCase().includes(q) || (team.description || "").toLowerCase().includes(q);
    });

    const visibleMembers = filteredMembers.slice(0, membersVisibleCount);
    const visibleTeams = filteredTeams.slice(0, teamsVisibleCount);

    useEffect(() => {
        fetchMembers();
    }, [orgId]);

    const fetchMembers = async () => {
        setLoading(true);
        try {
            const [membersRes, roleRes, groupsRes] = await Promise.all([
                organizationsAPI.getMembers(orgId),
                organizationsAPI.getRole(orgId),
                groupsAPI.listByOrg(orgId),
            ]);
            setMembers(membersRes.data);
            setMyRole(roleRes.data?.role || null);
            setTeams(Array.isArray(groupsRes.data) ? groupsRes.data : []);
        } catch (err) {
            console.error("Failed to fetch members", err);
        } finally {
            setLoading(false);
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setInviting(true);
        setError("");
        setSuccess("");
        try {
            await organizationsAPI.invite(orgId, inviteEmail, inviteRole);
            setInviteEmail("");
            setSuccess(`Successfully invited ${inviteEmail}`);
            setShowInviteModal(false);
            await fetchMembers();
        } catch (err: unknown) {
            const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
            setError(detail || "Failed to invite user");
        } finally {
            setInviting(false);
        }
    };

    const handleRemoveMember = async (userId: string) => {
        if (!confirm("Are you sure you want to remove this member?")) return;
        setRemovingUserId(userId);
        try {
            await organizationsAPI.removeMember(orgId, userId);
            setMembers(prev => prev.filter(m => m.user_id !== userId));
        } catch (err) {
            console.error("Failed to remove member", err);
        } finally {
            setRemovingUserId(null);
        }
    };

    const handleCreateTeam = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = newTeamName.trim();
        if (!trimmedName || !canManageMembers) return;

        setCreatingTeam(true);
        setError("");
        try {
            await groupsAPI.create(orgId, trimmedName, newTeamDescription.trim() || undefined);
            setNewTeamName("");
            setNewTeamDescription("");
            setShowCreateTeamModal(false);
            await fetchMembers();
        } catch (err: unknown) {
            const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
            setError(detail || "Failed to create team");
        } finally {
            setCreatingTeam(false);
        }
    };

    return (
        <div className="container-fluid">
            <div style={{ marginBottom: "24px" }}>
                <Link href="/organizations" className="btn btn-ghost btn-sm" style={{ paddingLeft: 0 }}>
                    <ArrowLeft size={16} /> Back to Workspaces
                </Link>
            </div>

            <header className="page-header">
                <div>
                    <h1 className="page-title">Workspace Access</h1>
                    <p className="page-subtitle">Review members and manage workspace teams in one place</p>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                    {canManageMembers && activeTab === "teams" && (
                        <button className="btn btn-secondary" onClick={() => setShowCreateTeamModal(true)}>
                            <Plus size={18} /> Create Team
                        </button>
                    )}
                    {canManageMembers && activeTab === "members" && (
                        <button className="btn btn-primary" onClick={() => setShowInviteModal(true)}>
                            <UserPlus size={18} /> Invite Member
                        </button>
                    )}
                </div>
            </header>

            <div className="workspace-tabs">
                <button
                    className={`workspace-tab ${activeTab === "members" ? "active" : ""}`}
                    onClick={() => setActiveTab("members")}
                >
                    Members ({members.length})
                </button>
                <button
                    className={`workspace-tab ${activeTab === "teams" ? "active" : ""}`}
                    onClick={() => setActiveTab("teams")}
                >
                    Teams ({teams.length})
                </button>
            </div>

            {activeTab === "members" ? (
                <div className="card glass">
                    <div className="card-header section-header-row" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "16px 24px" }}>
                        <h3 style={{ display: "flex", alignItems: "center", gap: "10px", margin: 0 }}>
                            <Users size={20} color="#6366f1" /> Team Members
                        </h3>
                        <div className="section-search-wrap">
                            <Search size={15} className="section-search-icon" />
                            <input
                                className="input section-search-input"
                                placeholder="Search members by email"
                                value={memberSearch}
                                onChange={(e) => {
                                    setMemberSearch(e.target.value);
                                    setMembersVisibleCount(12);
                                }}
                            />
                        </div>
                    </div>
                    <div className="card-body" style={{ padding: 0 }}>
                        {loading ? (
                            <div className="p-8 text-center"><div className="spinner" /></div>
                        ) : filteredMembers.length === 0 ? (
                            <div className="p-8 text-center text-muted">No members found.</div>
                        ) : (
                            <>
                                <div className="table-responsive">
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>Member</th>
                                                <th>Role</th>
                                                <th>Teams</th>
                                                <th>Joined</th>
                                                {canManageMembers && <th className="text-right">Actions</th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visibleMembers.map((member) => (
                                                <tr key={member.id} className={removingUserId === member.user_id ? "async-pending" : ""}>
                                                    <td>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                            <div className="avatar-sm">{member.users.email[0].toUpperCase()}</div>
                                                            <div style={{ fontSize: "0.9rem", fontWeight: 500 }}>{member.users.email}</div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={`badge-role ${member.role}`}>
                                                            {member.role.toUpperCase()}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {member.groups && member.groups.length > 0 ? (
                                                            <div className="member-teams-cell">
                                                                <span className="member-teams-count">{member.groups.length} teams</span>
                                                                <div className="group-badges-wrap">
                                                                    {member.groups.slice(0, 2).map((group) => (
                                                                        <span
                                                                            key={`${member.user_id}-${group.group_id}`}
                                                                            className={`badge-group ${group.role === "admin" ? "group-admin" : "group-member"}`}
                                                                            title={`${group.group_name} (${group.role})`}
                                                                        >
                                                                            {group.group_name}
                                                                        </span>
                                                                    ))}
                                                                    {member.groups.length > 2 && (
                                                                        <span className="badge-group group-member">+{member.groups.length - 2} more</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span style={{ fontSize: "0.82rem", color: "#64748b" }}>No teams</span>
                                                        )}
                                                    </td>
                                                    <td style={{ fontSize: "0.85rem", color: "#64748b" }}>
                                                        {new Date(member.joined_at).toLocaleDateString()}
                                                    </td>
                                                    {canManageMembers && (
                                                        <td className="text-right">
                                                            {canRemoveMember(member.role) && (
                                                                <button
                                                                    className="btn-icon btn-danger-soft"
                                                                    onClick={() => handleRemoveMember(member.user_id)}
                                                                    disabled={removingUserId === member.user_id}
                                                                >
                                                                    {removingUserId === member.user_id ? <span className="spinner spinner-inline" /> : <Trash2 size={14} />}
                                                                </button>
                                                            )}
                                                            {!canRemoveMember(member.role) && (
                                                                <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Protected</span>
                                                            )}
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {filteredMembers.length > visibleMembers.length && (
                                    <div className="load-more-wrap">
                                        <button className="btn btn-ghost" onClick={() => setMembersVisibleCount((prev) => prev + 12)}>
                                            Load more members
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            ) : (
                <div className="card glass">
                    <div className="card-header section-header-row" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "16px 24px" }}>
                        <h3 style={{ display: "flex", alignItems: "center", gap: "10px", margin: 0 }}>
                            <Users size={20} color="#10b981" /> Workspace Teams
                        </h3>
                        <div className="section-search-wrap">
                            <Search size={15} className="section-search-icon" />
                            <input
                                className="input section-search-input"
                                placeholder="Search teams"
                                value={teamSearch}
                                onChange={(e) => {
                                    setTeamSearch(e.target.value);
                                    setTeamsVisibleCount(8);
                                }}
                            />
                        </div>
                    </div>
                    <div className="card-body" style={{ padding: "16px 24px" }}>
                        {loading ? (
                            <div className="p-8 text-center"><div className="spinner" /></div>
                        ) : filteredTeams.length === 0 ? (
                            <div className="text-muted" style={{ fontSize: "0.9rem" }}>
                                No teams found for this filter.
                            </div>
                        ) : (
                            <>
                                <div className="teams-list">
                                    {visibleTeams.map((team) => (
                                        <div key={team.id} className="team-row">
                                            <div className="team-row-main">
                                                <div className="team-row-name">{team.name}</div>
                                                <div className="team-row-desc">{team.description || "No description provided."}</div>
                                            </div>
                                            <div className="team-row-meta">
                                                <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                                                    {new Date(team.created_at).toLocaleDateString()}
                                                </span>
                                                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                                                    <Link href={`/groups/${team.id}`} className="entity-link">
                                                        Team Details <ArrowRight size={14} />
                                                    </Link>
                                                    <Link href={`/dashboard?orgId=${orgId}&groupId=${team.id}`} className="btn btn-ghost btn-sm">
                                                        <MessageSquare size={13} /> Team Activity
                                                    </Link>
                                                    <Link href={`/upload?orgId=${orgId}&groupId=${team.id}`} className="btn btn-ghost btn-sm">
                                                        <Upload size={13} /> Upload to Team
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {filteredTeams.length > visibleTeams.length && (
                                    <div className="load-more-wrap">
                                        <button className="btn btn-ghost" onClick={() => setTeamsVisibleCount((prev) => prev + 8)}>
                                            Load more teams
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {showInviteModal && canManageMembers && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: "440px" }}>
                        <div className="modal-header">
                            <h2 className="modal-title">Invite Member</h2>
                            <button className="modal-close" onClick={() => setShowInviteModal(false)}>&times;</button>
                        </div>
                        <form onSubmit={handleInvite}>
                            <div className="form-group">
                                <label className="form-label">Email Address</label>
                                <div className="input-with-icon">
                                    <Mail size={16} className="input-icon" />
                                    <input
                                        type="email"
                                        className="input"
                                        placeholder="colleague@company.com"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Role</label>
                                <div className="input-with-icon">
                                    <Shield size={16} className="input-icon" />
                                    <select
                                        className="input"
                                        value={inviteRole}
                                        onChange={(e) => setInviteRole(e.target.value)}
                                    >
                                        <option value="member">Member</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                            </div>
                            {error && <div className="alert alert-error" style={{ marginBottom: "12px", fontSize: "0.85rem" }}>{error}</div>}
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowInviteModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={inviting}>
                                    {inviting ? <><span className="spinner spinner-inline" /> Inviting...</> : "Send Invitation"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showCreateTeamModal && canManageMembers && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: "460px" }}>
                        <div className="modal-header">
                            <h2 className="modal-title">Create Team</h2>
                            <button className="modal-close" onClick={() => setShowCreateTeamModal(false)}>&times;</button>
                        </div>
                        <form onSubmit={handleCreateTeam}>
                            <div className="form-group">
                                <label className="form-label">Team Name</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="e.g. Engineering Team"
                                    value={newTeamName}
                                    onChange={(e) => setNewTeamName(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description (Optional)</label>
                                <textarea
                                    className="textarea"
                                    placeholder="What is this team for?"
                                    value={newTeamDescription}
                                    onChange={(e) => setNewTeamDescription(e.target.value)}
                                    rows={3}
                                />
                            </div>
                            {error && <div className="alert alert-error" style={{ marginBottom: "12px", fontSize: "0.85rem" }}>{error}</div>}
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowCreateTeamModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={creatingTeam}>
                                    {creatingTeam ? <><span className="spinner spinner-inline" /> Creating...</> : "Create Team"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}

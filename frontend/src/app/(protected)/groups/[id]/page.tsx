"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Users, UserPlus, Trash2, ArrowLeft, Shield, MessageSquare, Calendar, Clock, Upload } from "lucide-react";
import { groupsAPI, organizationsAPI, lecturesAPI } from "@/lib/api";
import { Lecture } from "@/types";

interface Member {
    id: string;
    user_id: string;
    role: string;
    joined_at?: string;
    users: {
        email: string;
    };
}

interface GroupInfo {
    id: string;
    org_id: string;
    name: string;
    description?: string;
    my_org_role?: string;
    my_group_role?: string | null;
    can_manage_members?: boolean;
}

interface OrgMember {
    user_id: string;
    role: string;
    users: {
        email: string;
    };
}

function formatDateTime(dateValue?: string) {
    if (!dateValue) return "-";
    const d = new Date(dateValue);
    return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function getDateBucket(dateValue?: string) {
    if (!dateValue) return "Unknown";
    const target = new Date(dateValue);

    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();

    const diffDays = Math.floor((startToday - startTarget) / (24 * 60 * 60 * 1000));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return target.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function LectureStatusBadge({ status }: { status: string }) {
    const labels: Record<string, string> = {
        uploading: "Uploading",
        transcribing: "Processing",
        summarizing: "Summarizing",
        processing_rag: "Indexing",
        completed: "Completed",
        failed: "Failed",
    };

    return <span className={`badge-role ${status === "completed" ? "admin" : "member"}`}>{labels[status] || status}</span>;
}

export default function GroupDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const groupId = params.id as string;

    const [group, setGroup] = useState<GroupInfo | null>(null);
    const [groupMembers, setGroupMembers] = useState<Member[]>([]);
    const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
    const [teamLectures, setTeamLectures] = useState<Lecture[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUserId, setSelectedUserId] = useState("");
    const [selectedRole, setSelectedRole] = useState("member");
    const [memberSearch, setMemberSearch] = useState("");
    const [orgRoleFilter, setOrgRoleFilter] = useState<"all" | "owner" | "admin" | "member">("all");
    const [adding, setAdding] = useState(false);
    const [removingUserId, setRemovingUserId] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletingTeam, setDeletingTeam] = useState(false);
    const [activeView, setActiveView] = useState<"activity" | "members">("activity");
    const [activityDateFilter, setActivityDateFilter] = useState("");
    const [showDeleteMemberModal, setShowDeleteMemberModal] = useState(false);
    const [memberToDeleteId, setMemberToDeleteId] = useState<string | null>(null);
    const activityDateInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (groupId) {
            void fetchData();
        }
    }, [groupId]);

    const fetchData = async () => {
        setLoading(true);
        setError("");

        try {
            const groupRes = await groupsAPI.get(groupId);
            const groupData = groupRes.data as GroupInfo;
            setGroup(groupData);

            const [membersRes, orgMembersRes, lecturesRes] = await Promise.all([
                groupsAPI.getMembers(groupId),
                organizationsAPI.getMembers(groupData.org_id),
                lecturesAPI.list(undefined, groupId),
            ]);

            setGroupMembers(Array.isArray(membersRes.data) ? membersRes.data : []);
            setOrgMembers(Array.isArray(orgMembersRes.data) ? orgMembersRes.data : []);

            const lectureList: Lecture[] = Array.isArray(lecturesRes.data?.lectures) ? lecturesRes.data.lectures : [];
            lectureList.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
            setTeamLectures(lectureList);
        } catch (err: unknown) {
            const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
            setError(detail || "Failed to load team data");
        } finally {
            setLoading(false);
        }
    };

    const canManageMembers = !!group?.can_manage_members;
    const orgRoleByUser = new Map(orgMembers.map((m) => [m.user_id, m.role]));

    const canRemoveFromTeam = (userId: string) => {
        const role = orgRoleByUser.get(userId);
        return role !== "owner" && role !== "admin";
    };

    const memberUserIds = new Set(groupMembers.map((m) => m.user_id));
    const availableOrgMembers = orgMembers
        .filter((m) => !memberUserIds.has(m.user_id))
        .filter((m) => m.role !== "owner")
        .filter((m) => (orgRoleFilter === "all" ? true : m.role === orgRoleFilter))
        .filter((m) => {
            const query = memberSearch.trim().toLowerCase();
            if (!query) return true;
            return (m.users?.email || "").toLowerCase().includes(query);
        });

    const filteredActivity = teamLectures.filter((lecture) => {
        if (!activityDateFilter) return true;
        if (!lecture.created_at) return false;

        const created = new Date(lecture.created_at);
        const localDateKey = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}-${String(created.getDate()).padStart(2, "0")}`;
        return localDateKey === activityDateFilter;
    });

    const groupedActivity = filteredActivity.reduce<Record<string, Lecture[]>>((acc, lecture) => {
        const bucket = getDateBucket(lecture.created_at);
        if (!acc[bucket]) acc[bucket] = [];
        acc[bucket].push(lecture);
        return acc;
    }, {});

    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUserId) {
            setError("Select a user to add");
            return;
        }

        setAdding(true);
        setError("");
        setSuccess("");

        try {
            await groupsAPI.addMember(groupId, selectedUserId, selectedRole);
            setSelectedUserId("");
            setSelectedRole("member");
            setSuccess("Member added to team");
            setShowAddModal(false);
            await fetchData();
        } catch (err: unknown) {
            const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
            setError(detail || "Failed to add member");
        } finally {
            setAdding(false);
        }
    };

    const handleRemoveMember = async (userId: string) => {
        setMemberToDeleteId(userId);
        setShowDeleteMemberModal(true);
    };

    const confirmRemoveMember = async () => {
        if (!memberToDeleteId) return;
        
        const userId = memberToDeleteId;
        setShowDeleteMemberModal(false);
        setRemovingUserId(userId);
        setError("");
        setSuccess("");

        try {
            await groupsAPI.removeMember(groupId, userId);
            setSuccess("Member removed from team");
            setGroupMembers((prev) => prev.filter((m) => m.user_id !== userId));
            setMemberToDeleteId(null);
        } catch (err: unknown) {
            const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
            setError(detail || "Failed to remove member");
        } finally {
            setRemovingUserId(null);
        }
    };

    const cancelRemoveMember = () => {
        setShowDeleteMemberModal(false);
        setMemberToDeleteId(null);
    };

    const handleDeleteTeam = async () => {
        setDeletingTeam(true);
        setError("");
        try {
            await groupsAPI.delete(groupId);
            router.push(`/organizations/${group?.org_id}`);
        } catch (err: unknown) {
            const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
            setError(detail || "Failed to delete team");
            setDeletingTeam(false);
        }
    };

    return (
        <div className="container-fluid">
            <div style={{ marginBottom: "24px" }}>
                <Link href="/groups" className="btn btn-ghost btn-sm" style={{ paddingLeft: 0 }}>
                    <ArrowLeft size={16} /> Back to Teams
                </Link>
            </div>

            <header className="page-header">
                <div>
                    <h1 className="page-title">{group?.name || "Team Details"}</h1>
                    <p className="page-subtitle">See team activity by date and manage members in one place</p>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                    <button className="btn btn-secondary" onClick={() => setActiveView("members")}>
                        <Users size={16} /> See All Members
                    </button>
                    {canManageMembers && (
                        <button
                            className="btn btn-primary"
                            onClick={() => {
                                setActiveView("members");
                                setShowAddModal(true);
                            }}
                        >
                            <UserPlus size={18} /> Add Member
                        </button>
                    )}
                    {(group?.my_group_role?.toLowerCase() === "owner" || group?.my_org_role?.toLowerCase() === "owner") && (
                        <button
                            className="btn btn-danger-soft"
                            onClick={() => setShowDeleteConfirm(true)}
                            title="Delete team"
                        >
                            <Trash2 size={16} /> Delete Team
                        </button>
                    )}
                </div>
            </header>

            {error && <div className="alert alert-error" style={{ marginBottom: "16px" }}>{error}</div>}
            {success && <div className="alert alert-success" style={{ marginBottom: "16px" }}>{success}</div>}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
                <div className="workspace-tabs" style={{ marginBottom: 0 }}>
                    <button className={`workspace-tab ${activeView === "activity" ? "active" : ""}`} onClick={() => setActiveView("activity")}>
                        Activity ({teamLectures.length})
                    </button>
                    <button className={`workspace-tab ${activeView === "members" ? "active" : ""}`} onClick={() => setActiveView("members")}>
                        Members ({groupMembers.length})
                    </button>
                </div>
                {activeView === "activity" && group && (
                    <Link href={`/upload?orgId=${group.org_id}&groupId=${group.id}`} className="btn btn-primary btn-sm">
                        <Upload size={15} /> Upload Here
                    </Link>
                )}
            </div>

            {activeView === "activity" && (
                <div className="card glass" style={{ marginBottom: "16px" }}>
                    <div className="card-header section-header-row" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "16px 24px" }}>
                        <h3 style={{ display: "flex", alignItems: "center", gap: "10px", margin: 0 }}>
                            <MessageSquare size={20} color="#22d3ee" /> Team Activity
                        </h3>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <input
                                ref={activityDateInputRef}
                                type="date"
                                value={activityDateFilter}
                                onChange={(e) => setActivityDateFilter(e.target.value)}
                                aria-label="Filter team activity by date"
                                style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }}
                            />
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                title="Choose date"
                                onClick={() => {
                                    const input = activityDateInputRef.current;
                                    if (!input) return;
                                    const picker = input as HTMLInputElement & { showPicker?: () => void };
                                    if (picker.showPicker) picker.showPicker();
                                    else input.click();
                                }}
                            >
                                <Calendar size={16} />
                            </button>
                        </div>
                    </div>
                    <div className="card-body" style={{ padding: "16px 24px" }}>
                        {loading ? (
                            <div className="p-8 text-center"><div className="spinner" /></div>
                        ) : filteredActivity.length === 0 ? (
                            <div className="text-muted" style={{ fontSize: "0.9rem" }}>No team activity found for this date range.</div>
                        ) : (
                            <div className="chat-list-wrap">
                                {Object.entries(groupedActivity).map(([bucket, items]) => (
                                    <div key={bucket} className="chat-group">
                                        <div className="chat-group-label">{bucket}</div>
                                        <div className="chat-group-items">
                                            {items.map((lecture) => {
                                                const canOpenChat = lecture.status === "completed";
                                                const preview = lecture.summary_text?.trim()
                                                    ? lecture.summary_text.trim().slice(0, 120)
                                                    : lecture.transcript_text?.trim()
                                                        ? lecture.transcript_text.trim().slice(0, 120)
                                                        : "No preview yet. Open this item to view transcript and AI output.";

                                                return (
                                                    <div key={lecture.id} className="chat-row-item">
                                                        <div className="chat-row-icon"><MessageSquare size={15} /></div>
                                                        <div className="chat-row-body">
                                                            <div className="chat-row-top">
                                                                <Link href={`/lecture/${lecture.id}`} className="chat-row-title-link">
                                                                    <div className="chat-row-title">{lecture.title}</div>
                                                                </Link>
                                                                <LectureStatusBadge status={lecture.status} />
                                                            </div>
                                                            <div className="chat-row-preview">{preview}{preview.length >= 120 ? "..." : ""}</div>
                                                            <div className="chat-row-meta">
                                                                <span><Calendar size={12} /> {formatDateTime(lecture.created_at)}</span>
                                                                <span><Clock size={12} /> Knowledge Item</span>
                                                            </div>
                                                        </div>
                                                        <div className="chat-row-actions">
                                                            <Link
                                                                href={`/lecture/${lecture.id}?tab=chat`}
                                                                className="btn btn-secondary btn-sm"
                                                                aria-disabled={!canOpenChat}
                                                                style={!canOpenChat ? { opacity: 0.55, pointerEvents: "none" } : undefined}
                                                            >
                                                                <MessageSquare size={13} /> Open Chat
                                                            </Link>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeView === "members" && (
                <div className="card glass">
                    <div className="card-header" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "20px 24px" }}>
                        <h3 style={{ display: "flex", alignItems: "center", gap: "10px", margin: 0 }}>
                            <Users size={20} color="#6366f1" /> Team Members
                        </h3>
                    </div>
                    <div className="card-body" style={{ padding: 0 }}>
                        {loading ? (
                            <div className="p-8 text-center"><div className="spinner" /></div>
                        ) : groupMembers.length === 0 ? (
                            <div className="p-8 text-center text-muted">No members in this team yet.</div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Member</th>
                                            <th>Team Role</th>
                                            <th>Joined</th>
                                            {canManageMembers && <th className="text-right">Actions</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {groupMembers.map((member) => (
                                            <tr key={member.id}>
                                                <td>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                        <div className="avatar-sm">{member.users?.email?.[0]?.toUpperCase() || "U"}</div>
                                                        <div style={{ fontSize: "0.9rem", fontWeight: 500 }}>{member.users?.email || member.user_id}</div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`badge-role ${member.role}`}>{member.role.toUpperCase()}</span>
                                                </td>
                                                <td style={{ fontSize: "0.85rem", color: "#64748b" }}>
                                                    {member.joined_at ? formatDateTime(member.joined_at) : "-"}
                                                </td>
                                                {canManageMembers && (
                                                    <td style={{ textAlign: "right" }}>
                                                        {canRemoveFromTeam(member.user_id) ? (
                                                            <button
                                                                className="btn btn-danger-soft btn-sm"
                                                                onClick={() => handleRemoveMember(member.user_id)}
                                                                disabled={removingUserId === member.user_id}
                                                                title="Remove this member from the team"
                                                                style={{ display: "flex", alignItems: "center", gap: "6px" }}
                                                            >
                                                                <Trash2 size={16} />
                                                                Remove
                                                            </button>
                                                        ) : (
                                                            <span style={{ fontSize: "0.85rem", color: "#94a3b8", padding: "4px 12px" }}>Protected</span>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showAddModal && canManageMembers && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: "480px" }}>
                        <div className="modal-header">
                            <h2 className="modal-title">Add Member to Team</h2>
                            <button className="modal-close" onClick={() => setShowAddModal(false)}>&times;</button>
                        </div>
                        <form onSubmit={handleAddMember}>
                            <div className="form-group">
                                <label className="form-label">Find Member</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Search by email"
                                    value={memberSearch}
                                    onChange={(e) => setMemberSearch(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Filter by Org Role</label>
                                <select
                                    className="input"
                                    value={orgRoleFilter}
                                    onChange={(e) => setOrgRoleFilter(e.target.value as "all" | "owner" | "admin" | "member")}
                                >
                                    <option value="all">All Roles</option>
                                    <option value="admin">Admin</option>
                                    <option value="member">Member</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Organization Member</label>
                                <select
                                    className="input"
                                    value={selectedUserId}
                                    onChange={(e) => setSelectedUserId(e.target.value)}
                                    required
                                >
                                    <option value="">Select member</option>
                                    {availableOrgMembers.map((member) => (
                                        <option key={member.user_id} value={member.user_id}>
                                            {member.users?.email} ({member.role})
                                        </option>
                                    ))}
                                </select>
                                <div style={{ marginTop: "6px", fontSize: "0.8rem", color: "#94a3b8" }}>
                                    {availableOrgMembers.length} available member(s)
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Team Role</label>
                                <div className="input-with-icon">
                                    <Shield size={16} className="input-icon" />
                                    <select
                                        className="input"
                                        value={selectedRole}
                                        onChange={(e) => setSelectedRole(e.target.value)}
                                    >
                                        <option value="member">Member</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                            </div>

                            {error && <div className="alert alert-error" style={{ marginBottom: "12px", fontSize: "0.85rem" }}>{error}</div>}

                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowAddModal(false)}>Cancel</button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={adding || availableOrgMembers.length === 0}
                                >
                                    {adding ? "Adding..." : "Add to Team"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showDeleteConfirm && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: "420px" }}>
                        <div className="modal-header">
                            <h2 className="modal-title">Delete Team</h2>
                            <button className="modal-close" onClick={() => setShowDeleteConfirm(false)}>
                                &times;
                            </button>
                        </div>
                        <div className="modal-body" style={{ padding: "16px 24px", marginBottom: "16px" }}>
                            <p style={{ margin: 0, color: "#e2e8f0" }}>
                                Are you sure you want to delete this team? All team data will be permanently removed and cannot be recovered.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={deletingTeam}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-danger"
                                onClick={() => handleDeleteTeam()}
                                disabled={deletingTeam}
                            >
                                {deletingTeam ? "Deleting..." : "Delete Team"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showDeleteMemberModal && memberToDeleteId && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: "420px" }}>
                        <div className="modal-header">
                            <h2 className="modal-title">Remove Member</h2>
                            <button className="modal-close" onClick={cancelRemoveMember}>
                                &times;
                            </button>
                        </div>
                        <div className="modal-body" style={{ padding: "16px 24px", marginBottom: "16px" }}>
                            <p style={{ margin: 0, color: "#e2e8f0" }}>
                                Are you sure you want to remove this member from the team? They will lose access to all team lectures and resources.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={cancelRemoveMember}
                                disabled={removingUserId === memberToDeleteId}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-danger"
                                onClick={confirmRemoveMember}
                                disabled={removingUserId === memberToDeleteId}
                            >
                                {removingUserId === memberToDeleteId ? "Removing..." : "Remove Member"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

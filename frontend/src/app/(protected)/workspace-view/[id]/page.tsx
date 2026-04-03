"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { organizationsAPI, groupsAPI, lecturesAPI } from "@/lib/api";
import { ArrowLeft, Users, MessageSquare, Calendar, Clock, Upload, Trash2 } from "lucide-react";
import { Lecture } from "@/types";

interface Team {
    id: string;
    name: string;
    description?: string;
}

interface Organization {
    id: string;
    name: string;
    subscription_tier: string;
    my_role?: string;
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

export default function WorkspaceViewPage() {
    const params = useParams();
    const workspaceId = params.id as string;

    const [workspace, setWorkspace] = useState<Organization | null>(null);
    const [teams, setTeams] = useState<Team[]>([]);
    const [teamLectures, setTeamLectures] = useState<Lecture[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
    const [activityDateFilter, setActivityDateFilter] = useState("");
    const activityDateInputRef = useRef<HTMLInputElement>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletingWorkspace, setDeletingWorkspace] = useState(false);

    useEffect(() => {
        if (workspaceId) {
            fetchData();
        }
    }, [workspaceId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [orgRes, teamsRes, lecturesRes] = await Promise.all([
                organizationsAPI.list(),
                groupsAPI.listByOrg(workspaceId),
                lecturesAPI.list(workspaceId),
            ]);

            const orgList = Array.isArray(orgRes.data) ? orgRes.data : [];
            const currentOrg = orgList.find((org) => org.id === workspaceId);
            setWorkspace(currentOrg || null);

            const teamList = Array.isArray(teamsRes.data) ? teamsRes.data : [];
            setTeams(teamList);

            const lectureList: Lecture[] = Array.isArray(lecturesRes.data?.lectures)
                ? lecturesRes.data.lectures
                : [];
            lectureList.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
            setTeamLectures(lectureList);
        } catch (err: unknown) {
            console.error("Failed to load workspace data:", err);
        } finally {
            setLoading(false);
        }
    };

    const filteredActivity = teamLectures.filter((lecture) => {
        // Filter by selected team
        if (selectedTeamId && lecture.group_id !== selectedTeamId) return false;

        // Filter by exact selected date
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

    const handleDeleteWorkspace = async () => {
        setDeletingWorkspace(true);
        try {
            await organizationsAPI.delete(workspaceId);
            window.location.href = "/organizations";
        } catch (err) {
            console.error("Failed to delete workspace:", err);
            setDeletingWorkspace(false);
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
                    <h1 className="page-title">{workspace?.name || "Workspace"}</h1>
                    <p className="page-subtitle">View all knowledge items and teams in this workspace</p>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                    <Link 
                        href={selectedTeamId ? `/upload?orgId=${workspaceId}&groupId=${selectedTeamId}` : `/upload?orgId=${workspaceId}`} 
                        className="btn btn-primary"
                    >
                        <Upload size={18} /> Upload Knowledge
                    </Link>
                    {workspace?.my_role?.toLowerCase() === "owner" && (
                        <button
                            className="btn btn-danger-soft"
                            onClick={() => setShowDeleteConfirm(true)}
                            title="Delete workspace"
                        >
                            <Trash2 size={16} /> Delete Workspace
                        </button>
                    )}
                </div>
            </header>

            {loading ? (
                <div className="flex-center" style={{ height: "400px" }}>
                    <div className="spinner" />
                </div>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "24px" }}>
                    {/* Teams Sidebar */}
                    <div className="card glass">
                        <div className="card-header" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "16px" }}>
                            <h3 style={{ display: "flex", alignItems: "center", gap: "8px", margin: 0, fontSize: "0.95rem" }}>
                                <Users size={18} /> Teams ({teams.length})
                            </h3>
                        </div>
                        <div className="card-body" style={{ padding: "12px" }}>
                            {teams.length === 0 ? (
                                <div style={{ fontSize: "0.85rem", color: "#aaaaaa", textAlign: "center", padding: "20px 12px" }}>
                                    No teams in this workspace yet
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => setSelectedTeamId(null)}
                                        style={{
                                            justifyContent: "flex-start",
                                            background: selectedTeamId === null ? "rgba(0, 212, 255, 0.1)" : "transparent",
                                            color: selectedTeamId === null ? "#00D4FF" : "var(--text-secondary)",
                                            borderRadius: "6px",
                                            padding: "8px 12px",
                                            fontSize: "0.9rem",
                                        }}
                                    >
                                        All Teams
                                    </button>
                                    {teams.map((team) => (
                                        <button
                                            key={team.id}
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => setSelectedTeamId(team.id)}
                                            style={{
                                                justifyContent: "flex-start",
                                                background: selectedTeamId === team.id ? "rgba(0, 212, 255, 0.1)" : "transparent",
                                                color: selectedTeamId === team.id ? "#00D4FF" : "var(--text-secondary)",
                                                borderRadius: "6px",
                                                padding: "8px 12px",
                                                fontSize: "0.9rem",
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                            }}
                                            title={team.name}
                                        >
                                            {team.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Activity Feed */}
                    <div className="card glass">
                        <div className="card-header section-header-row" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "16px 24px" }}>
                            <h3 style={{ display: "flex", alignItems: "center", gap: "10px", margin: 0 }}>
                                <MessageSquare size={20} color="#FF6B2B" /> Workspace Activity
                            </h3>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <input
                                    ref={activityDateInputRef}
                                    type="date"
                                    value={activityDateFilter}
                                    onChange={(e) => setActivityDateFilter(e.target.value)}
                                    aria-label="Filter workspace activity by date"
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
                                <div className="p-8 text-center">
                                    <div className="spinner" />
                                </div>
                            ) : filteredActivity.length === 0 ? (
                                <div className="text-muted" style={{ fontSize: "0.9rem" }}>
                                    No activity found for this date range.
                                </div>
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
                                                            <div className="chat-row-icon">
                                                                <MessageSquare size={15} />
                                                            </div>
                                                            <div className="chat-row-body">
                                                                <div className="chat-row-top">
                                                                    <Link
                                                                        href={`/lecture/${lecture.id}`}
                                                                        className="chat-row-title-link"
                                                                    >
                                                                        <div className="chat-row-title">{lecture.title}</div>
                                                                    </Link>
                                                                    <LectureStatusBadge status={lecture.status} />
                                                                </div>
                                                                <div className="chat-row-preview">{preview}{preview.length >= 120 ? "..." : ""}</div>
                                                                <div className="chat-row-meta">
                                                                    <span>
                                                                        <Calendar size={12} /> {formatDateTime(lecture.created_at)}
                                                                    </span>
                                                                    <span>
                                                                        <Clock size={12} /> Knowledge Item
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="chat-row-actions">
                                                                <Link
                                                                    href={`/lecture/${lecture.id}?tab=chat`}
                                                                    className="btn btn-secondary btn-sm"
                                                                    aria-disabled={!canOpenChat}
                                                                    style={
                                                                        !canOpenChat
                                                                            ? { opacity: 0.55, pointerEvents: "none" }
                                                                            : undefined
                                                                    }
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
                </div>
            )}

            {showDeleteConfirm && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: "420px" }}>
                        <div className="modal-header">
                            <h2 className="modal-title">Delete Workspace</h2>
                            <button className="modal-close" onClick={() => setShowDeleteConfirm(false)}>
                                &times;
                            </button>
                        </div>
                        <div className="modal-body" style={{ padding: "16px 24px", marginBottom: "16px" }}>
                            <p style={{ margin: 0, color: "#cccccc" }}>
                                Are you sure you want to delete this workspace? This action is permanent and cannot be undone.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={deletingWorkspace}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-danger"
                                onClick={handleDeleteWorkspace}
                                disabled={deletingWorkspace}
                            >
                                {deletingWorkspace ? "Deleting..." : "Delete Workspace"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

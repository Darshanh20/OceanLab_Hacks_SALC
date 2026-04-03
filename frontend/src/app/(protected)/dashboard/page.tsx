"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { lecturesAPI, organizationsAPI, groupsAPI } from "@/lib/api";
import { Lecture } from "@/types";
import { BookOpen, CheckCircle2, Clock, Plus, Calendar, Trash2, Upload, Mic, Building2, Users } from "lucide-react";

interface WorkspaceFilter {
    id: string;
    name: string;
    my_role?: "owner" | "admin" | "member";
}

interface GroupFilter {
    id: string;
    name: string;
}

interface GroupDetails {
    my_group_role?: string | null;
}

const DOCUMENT_EXTENSIONS = new Set(["pdf", "docx", "pptx"]);

function getFileExtensionFromUrl(fileUrl?: string | null): string | null {
    if (!fileUrl) return null;
    try {
        const pathname = new URL(fileUrl).pathname;
        const filename = pathname.split("/").pop() || "";
        const dotIdx = filename.lastIndexOf(".");
        if (dotIdx === -1 || dotIdx === filename.length - 1) return null;
        return filename.slice(dotIdx + 1).toLowerCase();
    } catch {
        return null;
    }
}

function isDocumentLecture(lecture: Lecture) {
    const ext = getFileExtensionFromUrl(lecture.audio_url);
    if (ext && DOCUMENT_EXTENSIONS.has(ext)) return true;
    return !!lecture.transcript_text && !lecture.transcript_json;
}

function StatusBadge({ status, isDocument }: { status: string; isDocument?: boolean }) {
    const labels: Record<string, string> = {
        uploading: "Uploading", transcribing: isDocument ? "Extracting Text" : "Transcribing", summarizing: "Summarizing",
        processing_rag: "Indexing", completed: "Completed", failed: "Failed",
    };
    const isProcessing = !["completed", "failed"].includes(status);
    return (
        <span className={`badge badge-${status} ${isProcessing ? "badge-processing" : ""}`}>
            <span className="badge-dot" />
            {labels[status] || status}
        </span>
    );
}

export default function DashboardPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [lectures, setLectures] = useState<Lecture[]>([]);
    const [loading, setLoading] = useState(true);
    const [organizations, setOrganizations] = useState<WorkspaceFilter[]>([]);
    const [groups, setGroups] = useState<GroupFilter[]>([]);
    const [selectedOrgId, setSelectedOrgId] = useState("");
    const [selectedGroupId, setSelectedGroupId] = useState("");
    const [selectedGroupRole, setSelectedGroupRole] = useState<string | null>(null);

    const orgRoleMap = new Map(organizations.map((org) => [org.id, org.my_role]));

    const fetchLectures = useCallback(async () => {
        try {
            if (selectedOrgId || selectedGroupId) {
                const orgFilter = selectedOrgId === "personal" ? undefined : selectedOrgId;
                const response = await lecturesAPI.list(orgFilter || undefined, selectedGroupId || undefined);
                setLectures(response.data.lectures || []);
                return;
            }

            // "All Workspaces" should include personal space plus every workspace the user belongs to.
            const requests = [
                lecturesAPI.list(undefined, undefined),
                ...organizations.map((org) => lecturesAPI.list(org.id, undefined)),
            ];
            const responses = await Promise.all(requests);
            const merged = responses.flatMap((res) => res.data.lectures || []);
            const deduped = Array.from(new Map(merged.map((lecture) => [lecture.id, lecture])).values());
            deduped.sort((a, b) => (new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()));
            setLectures(deduped);
        } catch {
            /* ignore */
        } finally {
            setLoading(false);
        }
    }, [selectedOrgId, selectedGroupId, organizations]);

    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const orgsRes = await organizationsAPI.list();
                const orgs = Array.isArray(orgsRes.data) ? orgsRes.data : [];
                setOrganizations(orgs);

                const queryOrgId = searchParams.get("orgId") || "";
                const queryGroupId = searchParams.get("groupId") || "";
                if (queryOrgId && (queryOrgId === "personal" || orgs.some((org) => org.id === queryOrgId))) {
                    setSelectedOrgId(queryOrgId);
                }
                if (queryGroupId) {
                    setSelectedGroupId(queryGroupId);
                }
            } catch {
                console.error("Failed to fetch filters");
            }
        };
        fetchFilters();
    }, [searchParams]);

    useEffect(() => {
        const fetchGroups = async () => {
            if (selectedOrgId && selectedOrgId !== "personal") {
                try {
                    const groupsRes = await groupsAPI.listByOrg(selectedOrgId);
                    setGroups(groupsRes.data);
                } catch (err) {
                    setGroups([]);
                }
            } else {
                setGroups([]);
                setSelectedGroupId("");
            }
        };
        fetchGroups();
    }, [selectedOrgId]);

    useEffect(() => {
        const fetchSelectedGroupRole = async () => {
            if (!selectedGroupId) {
                setSelectedGroupRole(null);
                return;
            }

            try {
                const res = await groupsAPI.get(selectedGroupId);
                const data = res.data as GroupDetails;
                setSelectedGroupRole(data?.my_group_role || null);
            } catch {
                setSelectedGroupRole(null);
            }
        };

        fetchSelectedGroupRole();
    }, [selectedGroupId]);

    useEffect(() => {
        fetchLectures();
    }, [fetchLectures]);

    useEffect(() => {
        const hasProcessing = lectures.some((l) => !["completed", "failed"].includes(l.status));
        if (hasProcessing) {
            const interval = setInterval(fetchLectures, 5000);
            return () => clearInterval(interval);
        }
    }, [lectures, fetchLectures]);

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm("Delete this knowledge item?")) return;
        try {
            await lecturesAPI.delete(id);
            setLectures((prev) => prev.filter((l) => l.id !== id));
        } catch { /* ignore */ }
    };

    const canDeleteLecture = (lecture: Lecture) => {
        // In Personal Space scope, listed items are user's own items, so allow delete.
        if (selectedOrgId === "personal") return true;

        // Personal content can be deleted by the current user.
        if (!lecture.org_id) return true;

        const orgRole = orgRoleMap.get(lecture.org_id);
        if (orgRole === "owner") return true;

        // Team-scoped item: allow team admin delete when in selected team context.
        if (lecture.group_id && selectedGroupId === lecture.group_id && selectedGroupRole === "admin") return true;

        return false;
    };

    const completedCount = lectures.filter((l) => l.status === "completed").length;
    const processingCount = lectures.filter((l) => !["completed", "failed"].includes(l.status)).length;
    const selectedWorkspace = organizations.find((org) => org.id === selectedOrgId);
    const uploadPath = selectedOrgId
        ? `/upload?orgId=${encodeURIComponent(selectedOrgId)}${selectedGroupId ? `&groupId=${encodeURIComponent(selectedGroupId)}` : ""}`
        : "/upload";

    if (loading) {
        return <div className="loading-screen"><div className="spinner spinner-lg" /><p>Loading...</p></div>;
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Dashboard</h1>
                    <p className="page-subtitle">One place to ingest knowledge, monitor processing, and open team-ready outputs</p>
                </div>
            </div>

            <section className="dashboard-shell">
                <div className="dashboard-panel dashboard-panel-filters">
                    <div className="dashboard-panel-title">Scope</div>
                    <div className="dashboard-fields">
                        <label className="dashboard-field">
                            <span className="dashboard-field-label"><Building2 size={14} /> Workspace</span>
                            <select
                                className="dashboard-select"
                                value={selectedOrgId}
                                onChange={(e) => setSelectedOrgId(e.target.value)}
                            >
                                <option value="">All Workspaces</option>
                                <option value="personal">Personal Space</option>
                                {organizations.map((org) => (
                                    <option key={org.id} value={org.id}>{org.name}</option>
                                ))}
                            </select>
                        </label>
                        <label className="dashboard-field">
                            <span className="dashboard-field-label"><Users size={14} /> Team</span>
                            <select
                                className="dashboard-select"
                                value={selectedGroupId}
                                onChange={(e) => setSelectedGroupId(e.target.value)}
                                disabled={!selectedOrgId || selectedOrgId === "personal"}
                            >
                                <option value="">All Teams</option>
                                {groups.map((group) => (
                                    <option key={group.id} value={group.id}>{group.name}</option>
                                ))}
                            </select>
                        </label>
                    </div>
                </div>

                <div className="dashboard-panel dashboard-panel-actions">
                    <div>
                        <div className="dashboard-panel-title">Quick Actions</div>
                        <p className="dashboard-panel-subtitle">
                            {selectedOrgId === "personal"
                                ? "Working in Personal Space"
                                : selectedWorkspace
                                    ? `Working in ${selectedWorkspace.name}`
                                    : "Working across all workspaces"}
                        </p>
                    </div>
                    <div className="dashboard-actions">
                        <button className="btn btn-primary" onClick={() => router.push(uploadPath)}>
                            <Upload size={16} /> Upload Knowledge
                        </button>
                        <button className="btn btn-secondary" onClick={() => router.push("/record")}>
                            <Mic size={16} /> Record Meeting
                        </button>
                    </div>
                </div>
            </section>

            <div className="dashboard-stats">
                <div className="stat-card">
                    <span className="stat-icon-wrap" style={{ background: "rgba(99,102,241,0.12)", color: "#818cf8" }}><BookOpen size={22} /></span>
                    <div><div className="stat-value">{lectures.length}</div><div className="stat-label">Total Knowledge Items</div></div>
                </div>
                <div className="stat-card">
                    <span className="stat-icon-wrap" style={{ background: "rgba(16,185,129,0.12)", color: "#34d399" }}><CheckCircle2 size={22} /></span>
                    <div><div className="stat-value">{completedCount}</div><div className="stat-label">Completed</div></div>
                </div>
                <div className="stat-card">
                    <span className="stat-icon-wrap" style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24" }}><Clock size={22} /></span>
                    <div><div className="stat-value">{processingCount}</div><div className="stat-label">Processing</div></div>
                </div>
                <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => router.push(uploadPath)}>
                    <span className="stat-icon-wrap" style={{ background: "rgba(168,85,247,0.12)", color: "#a855f7" }}><Plus size={22} /></span>
                    <div><div className="stat-value" style={{ fontSize: "1rem" }}>Create</div><div className="stat-label">New Item</div></div>
                </div>
            </div>

            {lectures.length === 0 ? (
                <div className="empty-state">
                    <span className="empty-state-icon"><BookOpen size={48} strokeWidth={1.5} /></span>
                    <h3>No knowledge items yet</h3>
                    <p>Upload docs/media or record a meeting to build your internal knowledge base.</p>
                    <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                        <button className="btn btn-primary" onClick={() => router.push(uploadPath)}><Upload size={16} /> Upload</button>
                        <button className="btn btn-secondary" onClick={() => router.push("/record")}><Mic size={16} /> Record Meeting</button>
                    </div>
                </div>
            ) : (
                <div className="lectures-grid">
                    {lectures.map((lecture) => (
                        <div key={lecture.id} className="lecture-card" onClick={() => router.push(`/lecture/${lecture.id}`)}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div className="lecture-card-title">{lecture.title}</div>
                                <StatusBadge status={lecture.status} isDocument={isDocumentLecture(lecture)} />
                            </div>
                            <div className="lecture-card-meta">
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Calendar size={13} /> {lecture.created_at ? new Date(lecture.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</span>
                            </div>
                            {lecture.status === "failed" && lecture.summary_text && (
                                <div className="alert alert-error" style={{ fontSize: "0.78rem", padding: "8px 12px", marginTop: "4px" }}>
                                    {lecture.summary_text.slice(0, 120)}...
                                </div>
                            )}
                            <div className="lecture-card-actions">
                                {canDeleteLecture(lecture) && (
                                    <button className="btn btn-danger btn-sm" onClick={(e) => handleDelete(e, lecture.id)}><Trash2 size={14} /> Delete</button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

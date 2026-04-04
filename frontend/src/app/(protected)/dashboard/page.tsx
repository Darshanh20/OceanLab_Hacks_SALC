"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { lecturesAPI, organizationsAPI, groupsAPI } from "@/lib/api";
import { Lecture } from "@/types";
import { BookOpen, Calendar, Trash2, Upload, Mic, Building2, Users, Sparkles, MessageSquare, Share2, MoreHorizontal, Zap, CircleDot, Bot, ArrowRight, Lightbulb, FileQuestion, Layers, ChevronRight } from "lucide-react";

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

function getProgressPercent(status: string) {
    const map: Record<string, number> = {
        uploading: 14,
        transcribing: 42,
        summarizing: 68,
        processing_rag: 84,
        completed: 100,
        failed: 100,
    };
    return map[status] ?? 0;
}

function getStatusDetail(status: string) {
    const map: Record<string, string> = {
        uploading: "Uploading source",
        transcribing: "Transcribing",
        summarizing: "Generating Summary",
        processing_rag: "Building Q&A index",
        completed: "Summary · Notes · Q&A Ready",
        failed: "Processing failed",
    };
    return map[status] || status;
}

interface PendingSummary {
    voice?: { type: string; duration: number } | null;
    document?: { type: string; filename: string } | null;
    video?: { type: string; url: string } | null;
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
    const [openMenuLectureId, setOpenMenuLectureId] = useState<string | null>(null);
    const [pendingSummary, setPendingSummary] = useState<PendingSummary | null>(null);

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

    // Load and process pending summary from localStorage
    useEffect(() => {
        const processPendingSummary = async () => {
            const storedSummary = localStorage.getItem("pendingSummary");
            if (!storedSummary) return;

            try {
                const parsed = JSON.parse(storedSummary);
                setPendingSummary(parsed);

                // Process voice recording
                if (parsed.voice?.audioBase64) {
                    try {
                        const base64Data = parsed.voice.audioBase64.split(",")[1];
                        const binaryString = atob(base64Data);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }
                        const audioBlob = new Blob([bytes], { type: "audio/webm" });
                        const formData = new FormData();
                        formData.append("title", `Recording - ${new Date().toLocaleDateString()}`);
                        formData.append("audio", audioBlob, "recording.webm");

                        const response = await lecturesAPI.upload(formData);
                        if (response.data?.id) {
                            setLectures((prev) => [response.data, ...prev]);
                            localStorage.removeItem("pendingSummary");
                            setPendingSummary(null);
                        }
                    } catch (err) {
                        console.error("Failed to upload voice recording:", err);
                    }
                    return;
                }

                // Process document file
                if (parsed.document?.fileBase64) {
                    try {
                        const base64Data = parsed.document.fileBase64.split(",")[1];
                        const binaryString = atob(base64Data);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }
                        const fileBlob = new Blob([bytes], { type: parsed.document.mimeType || "application/octet-stream" });
                        const formData = new FormData();
                        formData.append("title", parsed.document.filename.replace(/\.[^/.]+$/, ""));
                        formData.append("audio", fileBlob, parsed.document.filename);

                        const response = await lecturesAPI.upload(formData);
                        if (response.data?.id) {
                            setLectures((prev) => [response.data, ...prev]);
                            localStorage.removeItem("pendingSummary");
                            setPendingSummary(null);
                        }
                    } catch (err) {
                        console.error("Failed to upload document:", err);
                    }
                    return;
                }

                // For video URL: redirect to upload page with pre-filled URL
                // (Video URLs require special handling and can't be directly uploaded via FormData)
                if (parsed.video?.url) {
                    // Store the video URL and redirect to upload page
                    localStorage.setItem("prefilledVideoUrl", parsed.video.url);
                    localStorage.removeItem("pendingSummary");
                    setPendingSummary(null);
                    // User will need to go to /upload to process the video
                    return;
                }
            } catch (err) {
                console.error("Failed to parse pending summary:", err);
            }
        };

        const timer = setTimeout(processPendingSummary, 500);
        return () => clearTimeout(timer);
    }, []);

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
        try {
            await lecturesAPI.delete(id);
            setLectures((prev) => prev.filter((l) => l.id !== id));
            setOpenMenuLectureId((prev) => (prev === id ? null : prev));
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
    const recentLectures = [...lectures]
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .slice(0, 3);
    const firstCompletedLecture = recentLectures.find((l) => l.status === "completed") || lectures.find((l) => l.status === "completed");
    const lastUpdatedLecture = [...lectures]
        .filter((l) => l.created_at)
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];
    const lastActionText = lastUpdatedLecture
        ? `Last AI action: ${lastUpdatedLecture.status === "completed" ? "Summary Ready" : getStatusDetail(lastUpdatedLecture.status)} ${new Date(lastUpdatedLecture.created_at || 0).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
        : "Last AI action: No activity yet";
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
                    <h1 className="page-title">Turn meetings into decisions, not just notes.</h1>
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
                        <button className="btn btn-secondary" onClick={() => router.push(uploadPath)}>
                            <Upload size={16} /> Upload Knowledge
                        </button>
                        <button className="btn btn-secondary" onClick={() => router.push("/record")}>
                            <Mic size={16} /> Record Meeting
                        </button>
                    </div>
                </div>
            </section>

            <div className="dashboard-activity-strip">
                <div className="dashboard-activity-item">
                    <Zap size={14} />
                    <span>{processingCount} items processing</span>
                </div>
                <div className="dashboard-activity-divider" />
                <div className="dashboard-activity-item">
                    <CircleDot size={14} />
                    <span>{completedCount} completed today</span>
                </div>
                <div className="dashboard-activity-divider" />
                <div className="dashboard-activity-item dashboard-activity-item-grow">
                    <Bot size={14} />
                    <span>{lastActionText}</span>
                </div>
                <button className="dashboard-activity-view" onClick={() => router.push("/analytics")}>
                    <span>View All</span>
                    <ArrowRight size={14} />
                </button>
            </div>

            <div className="dashboard-content-layout">
                <div className="dashboard-content-main">
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
                        <div className="lectures-grid dashboard-lectures-list">
                            {lectures.map((lecture) => (
                                <div key={lecture.id} className="lecture-card" onClick={() => router.push(`/lecture/${lecture.id}`)}>
                                    <div className="lecture-card-top">
                                        <div className="lecture-card-title">{lecture.title}</div>
                                        <div className="lecture-card-top-right">
                                            <StatusBadge status={lecture.status} isDocument={isDocumentLecture(lecture)} />
                                            {canDeleteLecture(lecture) && (
                                                <>
                                                    <button
                                                        className="lecture-icon-btn"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setOpenMenuLectureId((prev) => (prev === lecture.id ? null : lecture.id));
                                                        }}
                                                        aria-label="More options"
                                                    >
                                                        <MoreHorizontal size={15} />
                                                    </button>
                                                    {openMenuLectureId === lecture.id && (
                                                        <div className="lecture-card-menu" onClick={(e) => e.stopPropagation()}>
                                                            <button
                                                                className="lecture-card-menu-item danger"
                                                                onClick={(e) => handleDelete(e, lecture.id)}
                                                            >
                                                                <Trash2 size={14} /> Delete
                                                            </button>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="lecture-card-meta">
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Calendar size={13} /> {lecture.created_at ? new Date(lecture.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</span>
                                    </div>

                                    <div className="lecture-status-line">
                                        <Sparkles size={14} /> {getStatusDetail(lecture.status)}
                                    </div>

                                    {!(["completed", "failed"].includes(lecture.status)) && (
                                        <div className="meeting-progress-card">
                                            <div className="meeting-progress-head">
                                                <span>{`${lecture.status === "transcribing" ? "Processing" : "Progress"}: ${getProgressPercent(lecture.status)}%`}</span>
                                                <button
                                                    className="meeting-progress-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(`/lecture/${lecture.id}`);
                                                    }}
                                                >
                                                    View Progress
                                                </button>
                                            </div>
                                            <div className="meeting-progress-track">
                                                <div className="meeting-progress-fill" style={{ width: `${getProgressPercent(lecture.status)}%` }} />
                                            </div>
                                            <div className="meeting-progress-steps">
                                                <span className={getProgressPercent(lecture.status) >= 40 ? "is-done" : ""}>Transcribing</span>
                                                <span className={getProgressPercent(lecture.status) >= 65 ? "is-done" : ""}>Generating Summary</span>
                                            </div>
                                        </div>
                                    )}

                                    {lecture.status === "failed" && lecture.summary_text && (
                                        <div className="alert alert-error" style={{ fontSize: "0.78rem", padding: "8px 12px", marginTop: "4px" }}>
                                            {lecture.summary_text.slice(0, 120)}...
                                        </div>
                                    )}

                                    <div className="lecture-card-actions">
                                        {lecture.status === "completed" && (
                                            <>
                                                <button
                                                    className="meeting-action-btn meeting-action-btn-open"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(`/lecture/${lecture.id}`);
                                                    }}
                                                >
                                                    Open
                                                </button>
                                                <button
                                                    className="meeting-action-btn meeting-action-btn-ask"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(`/lecture/${lecture.id}?tab=chat`);
                                                    }}
                                                >
                                                    <MessageSquare size={14} /> Ask AI
                                                </button>
                                                <button
                                                    className="meeting-action-btn"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <Share2 size={14} /> Share
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <aside className="dashboard-quick-menu">
                    <div className="dashboard-quick-card">
                        <div className="dashboard-quick-title-row">
                            <h3 className="dashboard-quick-title">Insights</h3>
                        </div>
                        <div className="dashboard-quick-list">
                            {recentLectures.length === 0 ? (
                                <div className="dashboard-quick-empty">No insights yet. Upload or record to generate insights.</div>
                            ) : (
                                recentLectures.map((item) => (
                                    <button
                                        key={item.id}
                                        className="dashboard-insight-item"
                                        onClick={() => router.push(`/lecture/${item.id}`)}
                                    >
                                        <span className="dashboard-insight-icon"><Lightbulb size={13} /></span>
                                        <span className="dashboard-insight-content">
                                            <span className="dashboard-insight-title">{item.title}</span>
                                            <span className="dashboard-insight-subtitle">{item.status === "completed" ? "Notes are ready for review" : getStatusDetail(item.status)}</span>
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                        <button className="dashboard-quick-link" onClick={() => router.push("/analytics")}>
                            View All Insights <ChevronRight size={14} />
                        </button>
                    </div>

                    <div className="dashboard-quick-card">
                        <h3 className="dashboard-quick-title">Quick Actions</h3>
                        <div className="dashboard-action-list">
                            <button
                                className="dashboard-action-item"
                                onClick={() => firstCompletedLecture ? router.push(`/lecture/${firstCompletedLecture.id}?tab=questions`) : router.push(uploadPath)}
                            >
                                <FileQuestion size={14} /> Create exam questions
                            </button>
                            <button
                                className="dashboard-action-item"
                                onClick={() => firstCompletedLecture ? router.push(`/lecture/${firstCompletedLecture.id}?tab=chat`) : router.push(uploadPath)}
                            >
                                <MessageSquare size={14} /> Ask AI on latest summary
                            </button>
                            <button
                                className="dashboard-action-item"
                                onClick={() => firstCompletedLecture ? router.push(`/lecture/${firstCompletedLecture.id}?tab=topics`) : router.push(uploadPath)}
                            >
                                <Layers size={14} /> Generate key topics
                            </button>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}

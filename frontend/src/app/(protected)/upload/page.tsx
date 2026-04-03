"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { lecturesAPI } from "@/lib/api";
import {
    Mic,
    FileText,
    CheckCircle2,
    FolderOpen,
    ArrowUpFromLine, Building2, Users,
} from "lucide-react";
import { organizationsAPI, groupsAPI } from "@/lib/api";

type UploadMode = "media" | "document";

export default function UploadPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const fileRef = useRef<HTMLInputElement>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const [mode, setMode] = useState<UploadMode>("media");
    const [title, setTitle] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [selectedOrgId, setSelectedOrgId] = useState("");
    const [selectedGroupId, setSelectedGroupId] = useState("");
    const [contextApplied, setContextApplied] = useState(false);

    // Initialize org and group from query params
    useEffect(() => {
        const initializeContext = async () => {
            if (contextApplied) return;
            
            try {
                const res = await organizationsAPI.list();
                const orgs = Array.isArray(res.data) ? res.data : [];
                setOrganizations(orgs);

                const queryOrgId = searchParams.get("orgId") || "";
                const queryGroupId = searchParams.get("groupId") || "";

                // Set organization
                if (queryOrgId && orgs.some((org) => org.id === queryOrgId)) {
                    setSelectedOrgId(queryOrgId);
                    
                    // Fetch and set group if provided
                    if (queryGroupId) {
                        try {
                            const groupRes = await groupsAPI.listByOrg(queryOrgId);
                            const orgGroups = Array.isArray(groupRes.data) ? groupRes.data : [];
                            setGroups(orgGroups);
                            if (orgGroups.some((group) => group.id === queryGroupId)) {
                                setSelectedGroupId(queryGroupId);
                            }
                        } catch (err) {
                            console.error("Failed to fetch groups", err);
                        }
                    }
                }
                
                setContextApplied(true);
            } catch (err) {
                console.error("Failed to fetch organizations", err);
                setContextApplied(true);
            }
        };
        
        initializeContext();
    }, []);

    // Fetch groups when org changes (but preserve group selection if valid)
    useEffect(() => {
        const fetchGroups = async () => {
            if (selectedOrgId) {
                try {
                    const res = await groupsAPI.listByOrg(selectedOrgId);
                    const newGroups = Array.isArray(res.data) ? res.data : [];
                    setGroups(newGroups);
                    
                    // Only clear the group if it's not in the new org's group list
                    if (selectedGroupId && !newGroups.some((g) => g.id === selectedGroupId)) {
                        setSelectedGroupId("");
                    }
                } catch (err) {
                    console.error("Failed to fetch groups", err);
                    setGroups([]);
                }
            } else {
                setGroups([]);
                setSelectedGroupId("");
            }
        };
        
        if (contextApplied) {
            fetchGroups();
        }
    }, [selectedOrgId, contextApplied]);

    // Auto-focus form when at least title is ready
    useEffect(() => {
        if (contextApplied && formRef.current) {
            formRef.current.querySelector<HTMLInputElement>(".form-label")?.parentElement?.querySelector("input")?.focus();
        }
    }, [contextApplied]);

    const isValidForMode = useCallback((f: File, selectedMode: UploadMode) => {
        const name = (f.name || "").toLowerCase();
        const isDoc =
            name.endsWith(".pdf") ||
            name.endsWith(".docx") ||
            name.endsWith(".pptx");
        const isMedia =
            f.type.startsWith("audio/") || f.type.startsWith("video/");
        return selectedMode === "media" ? isMedia : isDoc;
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setDragActive(false);
            const f = e.dataTransfer.files[0];
            if (f && isValidForMode(f, mode)) {
                setFile(f);
                if (!title) setTitle(f.name.replace(/\.[^/.]+$/, ""));
                setError("");
            } else if (f) {
                setError(
                    mode === "media"
                        ? "Please upload an audio/video file."
                        : "Please upload a PDF, DOCX, or PPTX file.",
                );
            }
        },
        [title, mode, isValidForMode],
    );

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f && isValidForMode(f, mode)) {
            setFile(f);
            if (!title) setTitle(f.name.replace(/\.[^/.]+$/, ""));
            setError("");
        } else if (f) {
            setFile(null);
            setError(
                mode === "media"
                    ? "Please choose an audio/video file."
                    : "Please choose a PDF, DOCX, or PPTX file.",
            );
        }
    };

    const handleModeChange = (nextMode: UploadMode) => {
        setMode(nextMode);
        setFile(null);
        setError("");
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !title.trim()) return;

        setError("");
        setUploading(true);

        try {
            // STEP 1: get upload URL from backend
            const formData = new FormData();
            formData.append("title", title.trim());
            formData.append("filename", file.name);
            if (selectedOrgId) formData.append("org_id", selectedOrgId);
            if (selectedGroupId) formData.append("group_id", selectedGroupId);

            const res = await lecturesAPI.uploadurl(formData);

            const { upload_url, path, lecture_id } = res.data;

            // STEP 2: upload file directly to storage
            await fetch(upload_url, {
                method: "PUT",
                body: file,
            });

            // STEP 3: confirm upload
            const confirmData = new FormData();
            confirmData.append("lecture_id", lecture_id);
            confirmData.append("path", path);
            if (selectedOrgId) confirmData.append("org_id", selectedOrgId);
            if (selectedGroupId) confirmData.append("group_id", selectedGroupId);
            await lecturesAPI.confirmupload(confirmData);

            // If uploaded into a workspace, prompt team sharing in the immediate post-upload flow.
            const shouldPromptShare = !!selectedOrgId;
            router.push(shouldPromptShare ? `/lecture/${lecture_id}?share=1` : `/lecture/${lecture_id}`);
        } catch (err: any) {
            setError(err?.message || "Upload failed");
            setUploading(false);
        }
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Upload Knowledge</h1>
                    <p className="page-subtitle">
                    Choose upload type: Audio/Video or Document (PDF/DOCX/PPTX)
                </p>
                </div>
            </div>

            <div className="card" style={{ maxWidth: "640px", margin: "0 auto" }}>
                <div style={{ marginBottom: "20px" }}>
                    <label
                        className="form-label"
                        style={{ marginBottom: "10px" }}
                    >
                        Upload Type
                    </label>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "10px",
                        }}
                    >
                        <button
                            type="button"
                            className="btn"
                            onClick={() => handleModeChange("media")}
                            style={{
                                justifyContent: "center",
                                background:
                                    mode === "media"
                                        ? "var(--primary-600)"
                                        : "var(--bg-surface)",
                                color:
                                    mode === "media"
                                        ? "#fff"
                                        : "var(--text-primary)",
                                border: "1px solid var(--border-subtle)",
                            }}
                        >
                            <Mic size={16} /> Audio / Video
                        </button>
                        <button
                            type="button"
                            className="btn"
                            onClick={() => handleModeChange("document")}
                            style={{
                                justifyContent: "center",
                                background:
                                    mode === "document"
                                        ? "var(--primary-600)"
                                        : "var(--bg-surface)",
                                color:
                                    mode === "document"
                                        ? "#fff"
                                        : "var(--text-primary)",
                                border: "1px solid var(--border-subtle)",
                            }}
                        >
                            <FileText size={16} /> PDF / DOCX / PPTX
                        </button>
                    </div>
                    <p
                        style={{
                            marginTop: "10px",
                            color: "var(--text-muted)",
                            fontSize: "0.85rem",
                        }}
                    >
                        {mode === "media"
                            ? "Use this for meetings, calls, or internal walkthrough videos."
                            : "Use this for company docs/slides. We extract text and process it like a transcript."}
                    </p>
                </div>

                <form onSubmit={handleUpload}>
                    <div
                        className="form-group"
                        style={{ marginBottom: "20px" }}
                    >
                        <label className="form-label">
                            Knowledge Item Title
                        </label>
                        <input
                            className="input"
                            type="text"
                            placeholder="e.g. Q2 Roadmap Review / Sales Playbook"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                        />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                        <div className="form-group">
                            <label className="form-label"><Building2 size={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: "4px" }} /> Workspace (Personal if none)</label>
                            <select 
                                className="input" 
                                value={selectedOrgId} 
                                onChange={(e) => setSelectedOrgId(e.target.value)}
                            >
                                <option value="">Personal Space</option>
                                {organizations.map(org => (
                                    <option key={org.id} value={org.id}>{org.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label"><Users size={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: "4px" }} /> Team (Optional)</label>
                            <select 
                                className="input" 
                                value={selectedGroupId} 
                                onChange={(e) => setSelectedGroupId(e.target.value)}
                                disabled={!selectedOrgId}
                            >
                                <option value="">All Teams (Visible to whole workspace)</option>
                                {groups.map(group => (
                                    <option key={group.id} value={group.id}>{group.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div
                        className={`upload-zone ${dragActive ? "active" : ""}`}
                        onDrop={handleDrop}
                        onDragOver={(e) => {
                            e.preventDefault();
                            setDragActive(true);
                        }}
                        onDragLeave={() => setDragActive(false)}
                        onClick={() => fileRef.current?.click()}
                    >
                        <input
                            ref={fileRef}
                            type="file"
                            accept={
                                mode === "media"
                                    ? "audio/*,video/*"
                                    : ".pdf,.docx,.pptx"
                            }
                            onChange={handleFileChange}
                            hidden
                        />
                        {file ? (
                            <>
                                <span className="upload-zone-icon">
                                    <CheckCircle2 size={40} color="#34d399" />
                                </span>
                                <h3>{file.name}</h3>
                                <p>
                                    {(file.size / 1024 / 1024).toFixed(1)} MB •
                                    Click to change
                                </p>
                            </>
                        ) : (
                            <>
                                <span className="upload-zone-icon">
                                    <FolderOpen size={40} color="#818cf8" />
                                </span>
                                <h3>Drop your file here or click to browse</h3>
                                <p>
                                    {mode === "media"
                                        ? "MP3, WAV, MP4, WebM, MOV • Max 25MB"
                                        : "PDF, DOCX, PPTX • Max 25MB"}
                                </p>
                            </>
                        )}
                    </div>

                    {error && (
                        <div
                            className="alert alert-error"
                            style={{ marginTop: "16px" }}
                        >
                            {error}
                        </div>
                    )}

                    <div
                        style={{
                            display: "flex",
                            gap: "12px",
                            marginTop: "24px",
                        }}
                    >
                        <button
                            type="submit"
                            className="btn btn-primary btn-lg"
                            disabled={!file || !title.trim() || uploading}
                            style={{ flex: 1 }}
                        >
                            {uploading ? (
                                <>
                                    <span
                                        className="spinner"
                                        style={{
                                            width: 18,
                                            height: 18,
                                            borderWidth: 2,
                                        }}
                                    />{" "}
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <ArrowUpFromLine size={18} /> Upload &amp;
                                    Process
                                </>
                            )}
                        </button>
                    </div>
                </form>

                <div
                    style={{
                        textAlign: "center",
                        marginTop: "20px",
                        color: "var(--text-muted)",
                        fontSize: "0.85rem",
                    }}
                >
                    Or{" "}
                    <Link
                        href="/record"
                        style={{ color: "var(--primary-400)" }}
                    >
                        <Mic
                            size={13}
                            style={{ display: "inline", verticalAlign: "-2px" }}
                        />{" "}
                        record a meeting directly
                    </Link>
                </div>
            </div>
        </div>
    );
}

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { lecturesAPI, organizationsAPI, groupsAPI } from "@/lib/api";
import { Mic, Play, Pause, Square, RotateCcw, ArrowUpFromLine, Upload, Building2, Users } from "lucide-react";

export default function RecordPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [title, setTitle] = useState("");
    const [recording, setRecording] = useState(false);
    const [paused, setPaused] = useState(false);
    const [recorded, setRecorded] = useState(false);
    const [seconds, setSeconds] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    const [bars, setBars] = useState<number[]>(Array(30).fill(4));
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [selectedOrgId, setSelectedOrgId] = useState("");
    const [selectedGroupId, setSelectedGroupId] = useState("");
    const [contextApplied, setContextApplied] = useState(false);

    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const audioChunks = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animRef = useRef<number>(0);

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
    };

    useEffect(() => {
        const initializeContext = async () => {
            if (contextApplied) return;

            try {
                const res = await organizationsAPI.list();
                const orgs = Array.isArray(res.data) ? res.data : [];
                setOrganizations(orgs);

                const queryOrgId = searchParams.get("orgId") || "";
                const queryGroupId = searchParams.get("groupId") || "";

                if (queryOrgId && orgs.some((org) => org.id === queryOrgId)) {
                    setSelectedOrgId(queryOrgId);
                    if (queryGroupId) {
                        const groupRes = await groupsAPI.listByOrg(queryOrgId);
                        const orgGroups = Array.isArray(groupRes.data) ? groupRes.data : [];
                        setGroups(orgGroups);
                        if (orgGroups.some((group) => group.id === queryGroupId)) {
                            setSelectedGroupId(queryGroupId);
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to initialize recording context", err);
            } finally {
                setContextApplied(true);
            }
        };

        initializeContext();
    }, [contextApplied, searchParams]);

    useEffect(() => {
        const fetchGroups = async () => {
            if (!selectedOrgId) {
                setGroups([]);
                setSelectedGroupId("");
                return;
            }

            try {
                const res = await groupsAPI.listByOrg(selectedOrgId);
                const nextGroups = Array.isArray(res.data) ? res.data : [];
                setGroups(nextGroups);
                if (selectedGroupId && !nextGroups.some((g) => g.id === selectedGroupId)) {
                    setSelectedGroupId("");
                }
            } catch (err) {
                console.error("Failed to fetch groups for recording", err);
                setGroups([]);
            }
        };

        if (contextApplied) {
            fetchGroups();
        }
    }, [selectedOrgId, contextApplied, selectedGroupId]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            });
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 64;
            source.connect(analyser);
            analyserRef.current = analyser;
            const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
            audioChunks.current = [];
            recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.current.push(e.data); };
            recorder.start(250);
            mediaRecorder.current = recorder;
            setRecording(true);
            setPaused(false);
            setRecorded(false);
            setSeconds(0);
            setError("");
            timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
            visualize();
        } catch {
            setError("Microphone access denied. Please allow microphone access.");
        }
    };

    const visualize = useCallback(() => {
        if (!analyserRef.current) return;
        const data = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(data);
        const newBars = Array.from({ length: 30 }, (_, i) => Math.max(4, (data[i] || 0) / 3.5));
        setBars(newBars);
        animRef.current = requestAnimationFrame(visualize);
    }, []);

    const stopRecording = () => {
        mediaRecorder.current?.stop();
        mediaRecorder.current?.stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        cancelAnimationFrame(animRef.current);
        setRecording(false);
        setPaused(false);
        setRecorded(true);
        setBars(Array(30).fill(4));
    };

    const pauseRecording = () => {
        if (paused) {
            mediaRecorder.current?.resume();
            timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
            visualize();
            setPaused(false);
        } else {
            mediaRecorder.current?.pause();
            if (timerRef.current) clearInterval(timerRef.current);
            cancelAnimationFrame(animRef.current);
            setPaused(true);
        }
    };

    const handleUpload = async () => {
        if (!title.trim() || audioChunks.current.length === 0) return;
        setUploading(true);
        setError("");
        try {
            const blob = new Blob(audioChunks.current, { type: "audio/webm" });
            const file = new File([blob], `${title.trim()}.webm`, { type: "audio/webm" });
            const formData = new FormData();
            formData.append("title", title.trim());
            formData.append("audio", file);
            if (selectedOrgId) formData.append("org_id", selectedOrgId);
            if (selectedGroupId) formData.append("group_id", selectedGroupId);
            const response = await lecturesAPI.upload(formData);
            router.push(`/lecture/${response.data.id}`);
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { detail?: string } } };
            setError(axiosErr.response?.data?.detail || "Upload failed");
            setUploading(false);
        }
    };

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            cancelAnimationFrame(animRef.current);
        };
    }, []);

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Record Meeting</h1>
                    <p className="page-subtitle">Capture internal meeting audio for transcription, summaries, and action items</p>
                </div>
            </div>

            <div className="card" style={{ maxWidth: "580px", textAlign: "center", margin: "0 auto" }}>
                <div className="form-group" style={{ marginBottom: "24px", textAlign: "left" }}>
                    <label className="form-label">Meeting Title</label>
                    <input className="input" type="text" placeholder="e.g. Product Sync - Q2 Planning" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px", textAlign: "left" }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label"><Building2 size={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: "4px" }} /> Workspace (Personal if none)</label>
                        <select
                            className="input"
                            value={selectedOrgId}
                            onChange={(e) => setSelectedOrgId(e.target.value)}
                        >
                            <option value="">Personal Space</option>
                            {organizations.map((org) => (
                                <option key={org.id} value={org.id}>{org.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label"><Users size={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: "4px" }} /> Team (Optional)</label>
                        <select
                            className="input"
                            value={selectedGroupId}
                            onChange={(e) => setSelectedGroupId(e.target.value)}
                            disabled={!selectedOrgId}
                        >
                            <option value="">All Teams (Visible to whole workspace)</option>
                            {groups.map((group) => (
                                <option key={group.id} value={group.id}>{group.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="record-timer">{formatTime(seconds)}</div>

                <div className="record-visualizer">
                    {bars.map((h, i) => (
                        <div key={i} className="record-bar" style={{ height: `${h}px` }} />
                    ))}
                </div>

                <div className="record-btn-group">
                    {!recording && !recorded && (
                        <button className="record-btn-main record-btn-start" onClick={startRecording} disabled={!title.trim()}>
                            <Mic size={24} />
                        </button>
                    )}
                    {recording && (
                        <>
                            <button className="btn btn-secondary btn-icon" onClick={pauseRecording} title={paused ? "Resume" : "Pause"}>
                                {paused ? <Play size={18} /> : <Pause size={18} />}
                            </button>
                            <button className="record-btn-main record-btn-start recording" onClick={stopRecording}>
                                <Square size={20} />
                            </button>
                        </>
                    )}
                    {recorded && (
                        <>
                            <button className="btn btn-secondary" onClick={startRecording}><RotateCcw size={16} /> Re-record</button>
                            <button className="btn btn-primary btn-lg" onClick={handleUpload} disabled={uploading}>
                                {uploading ? <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Processing...</> : <><ArrowUpFromLine size={18} /> Upload &amp; Process</>}
                            </button>
                        </>
                    )}
                </div>

                {recording && <p style={{ color: "var(--danger-400)", fontSize: "0.82rem", marginTop: "16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>{paused ? <><Pause size={14} /> Paused</> : <><span className="badge-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", animation: "recording-pulse 1.5s infinite", display: "inline-block" }} /> Recording...</>}</p>}
                {error && <div className="alert alert-error" style={{ marginTop: "16px" }}>{error}</div>}

                <div style={{ marginTop: "10px", color: "var(--text-muted)", fontSize: "0.82rem", textAlign: "left" }}>
                    Storage scope: {selectedOrgId ? (selectedGroupId ? "Specific team" : "Workspace-wide (all teams)") : "Personal space"}
                </div>

                <div style={{ marginTop: "24px", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                    Or <Link href="/upload" style={{ color: "var(--primary-400)" }}><Upload size={13} style={{ display: "inline", verticalAlign: "-2px" }} /> upload a file instead</Link>
                </div>
            </div>
        </div>
    );
}

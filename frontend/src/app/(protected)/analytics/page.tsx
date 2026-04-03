"use client";

import { useState, useEffect } from "react";
import { lecturesAPI } from "@/lib/api";
import { Lecture, TranscriptData } from "@/types";
import { BookOpen, CheckCircle2, Timer, FileEdit, Calendar, Globe, BarChart3, TrendingUp, Lightbulb, Pin, RotateCcw } from "lucide-react";

export default function AnalyticsPage() {
    const [lectures, setLectures] = useState<Lecture[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchData = async () => {
        try {
            const res = await lecturesAPI.list();
            setLectures(res.data.lectures || []);
        } catch { /* ignore */ }
        finally { setLoading(false); }
    };

    const handleRefreshAnalytics = async () => {
        setIsRefreshing(true);
        try {
            await fetchData();
        } finally {
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (loading) return <div className="loading-screen"><div className="spinner spinner-lg" /><p>Loading analytics...</p></div>;

    const completedLectures = lectures.filter((l) => l.status === "completed");
    const failedCount = lectures.filter((l) => l.status === "failed").length;

    let totalDuration = 0;
    let totalWords = 0;
    const languages: Record<string, number> = {};
    const dateCounts: Record<string, number> = {};

    completedLectures.forEach((l) => {
        if (l.transcript_json) {
            try {
                const td: TranscriptData = JSON.parse(l.transcript_json);
                totalDuration += td.duration_seconds || 0;
                totalWords += td.word_count || 0;
                const lang = td.detected_language || "en";
                languages[lang] = (languages[lang] || 0) + 1;
            } catch { /* ignore */ }
        }
        if (l.created_at) {
            const date = new Date(l.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
            dateCounts[date] = (dateCounts[date] || 0) + 1;
        }
    });

    const formatDuration = (sec: number) => {
        if (sec < 60) return `${Math.round(sec)}s`;
        if (sec < 3600) return `${Math.round(sec / 60)}m`;
        return `${(sec / 3600).toFixed(1)}h`;
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Analytics</h1>
                    <p className="page-subtitle">Track knowledge processing, meeting intelligence, and content statistics</p>
                </div>
                <button 
                    className="btn btn-secondary" 
                    onClick={handleRefreshAnalytics}
                    disabled={isRefreshing}
                >
                    <RotateCcw size={16} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} /> 
                    <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                </button>
            </div>

            <div className="dashboard-stats">
                <div className="stat-card">
                    <span className="stat-icon-wrap" style={{ background: "rgba(0,212,255,0.12)", color: "#00D4FF" }}><BookOpen size={22} /></span>
                    <div><div className="stat-value">{lectures.length}</div><div className="stat-label">Total Knowledge Items</div></div>
                </div>
                <div className="stat-card">
                    <span className="stat-icon-wrap" style={{ background: "rgba(0,212,255,0.12)", color: "#00D4FF" }}><CheckCircle2 size={22} /></span>
                    <div><div className="stat-value">{completedLectures.length}</div><div className="stat-label">Completed</div></div>
                </div>
                <div className="stat-card">
                    <span className="stat-icon-wrap" style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24" }}><Timer size={22} /></span>
                    <div><div className="stat-value">{formatDuration(totalDuration)}</div><div className="stat-label">Total Duration</div></div>
                </div>
                <div className="stat-card">
                    <span className="stat-icon-wrap" style={{ background: "rgba(255,107,43,0.12)", color: "#FF6B2B" }}><FileEdit size={22} /></span>
                    <div><div className="stat-value">{totalWords.toLocaleString()}</div><div className="stat-label">Total Words</div></div>
                </div>
            </div>

            <div className="analytics-grid">
                <div className="card analytics-card">
                    <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><Calendar size={16} /> Recent Activity</h3>
                    {Object.keys(dateCounts).length > 0 ? (
                        <div className="analytics-bar-chart">
                            {Object.entries(dateCounts).slice(-7).map(([date, count]) => (
                                <div key={date} className="analytics-bar-row">
                                    <span className="analytics-bar-label">{date}</span>
                                    <div className="analytics-bar-track">
                                        <div className="analytics-bar-fill" style={{ width: `${Math.min(100, count * 25)}%`, background: "linear-gradient(90deg, var(--primary-500), var(--accent-500))" }} />
                                    </div>
                                    <span className="analytics-bar-value">{count}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>No data yet. Upload docs/media or record meetings to see activity.</p>
                    )}
                </div>

                <div className="card analytics-card">
                    <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><Globe size={16} /> Languages Detected</h3>
                    {Object.keys(languages).length > 0 ? (
                        <div className="analytics-bar-chart">
                            {Object.entries(languages).map(([lang, count]) => (
                                <div key={lang} className="analytics-bar-row">
                                    <span className="analytics-bar-label">{lang.toUpperCase()}</span>
                                    <div className="analytics-bar-track">
                                        <div className="analytics-bar-fill" style={{ width: `${Math.min(100, (count / completedLectures.length) * 100)}%`, background: "linear-gradient(90deg, #a855f7, #ec4899)" }} />
                                    </div>
                                    <span className="analytics-bar-value">{count}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>No language data yet.</p>
                    )}
                </div>

                <div className="card analytics-card">
                    <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><BarChart3 size={16} /> Averages</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <div>
                            <div className="analytics-big-number" style={{ fontSize: "1.8rem" }}>
                                {completedLectures.length > 0 ? formatDuration(totalDuration / completedLectures.length) : "—"}
                            </div>
                            <div className="analytics-label">Avg. Duration / Item</div>
                        </div>
                        <div>
                            <div className="analytics-big-number" style={{ fontSize: "1.8rem" }}>
                                {completedLectures.length > 0 ? Math.round(totalWords / completedLectures.length).toLocaleString() : "—"}
                            </div>
                            <div className="analytics-label">Avg. Words / Item</div>
                        </div>
                    </div>
                </div>

                <div className="card analytics-card">
                    <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><TrendingUp size={16} /> Status Breakdown</h3>
                    <div className="analytics-bar-chart">
                        {[
                            { label: "Completed", count: completedLectures.length, color: "var(--accent-500)" },
                            { label: "Processing", count: lectures.filter((l) => !["completed", "failed"].includes(l.status)).length, color: "var(--primary-500)" },
                            { label: "Failed", count: failedCount, color: "var(--danger-500)" },
                        ].map((item) => (
                            <div key={item.label} className="analytics-bar-row">
                                <span className="analytics-bar-label">{item.label}</span>
                                <div className="analytics-bar-track">
                                    <div className="analytics-bar-fill" style={{ width: `${lectures.length > 0 ? (item.count / lectures.length) * 100 : 0}%`, background: item.color }} />
                                </div>
                                <span className="analytics-bar-value">{item.count}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card analytics-card" style={{ gridColumn: "span 2" }}>
                    <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><Lightbulb size={16} /> Workflow Suggestions</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "0.88rem", color: "var(--text-secondary)" }}>
                        {completedLectures.length === 0 ? (
                            <p>Upload your first knowledge item to get personalized suggestions!</p>
                        ) : (
                            <>
                                <p style={{ display: "flex", alignItems: "center", gap: 6 }}><Pin size={14} /> You have <strong>{completedLectures.length}</strong> processed items ready for team querying.</p>
                                <p style={{ display: "flex", alignItems: "center", gap: 6 }}><Pin size={14} /> Use <strong>Q&A Generator</strong> to auto-create stakeholder FAQ lists.</p>
                                <p style={{ display: "flex", alignItems: "center", gap: 6 }}><Pin size={14} /> Use <strong>Summary</strong> and <strong>Highlights</strong> views for faster knowledge handoff.</p>
                                {totalDuration > 3600 && <p style={{ display: "flex", alignItems: "center", gap: 6 }}><Pin size={14} /> You&apos;ve processed over 1 hour of meeting media. Great consistency!</p>}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

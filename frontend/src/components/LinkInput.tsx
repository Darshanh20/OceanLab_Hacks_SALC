"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, Search } from "lucide-react";

interface LinkInputProps {
    onSuccess: (lectureId: string) => void;
    onError: (error: string) => void;
    orgId?: string;
    groupId?: string;
}

type DetectedType = "youtube" | "google-drive" | "unknown" | null;
type ProgressStep = "detecting" | "extracting" | "transcribing";

export default function LinkInput({ onSuccess, onError, orgId, groupId }: LinkInputProps) {
    const [url, setUrl] = useState("");
    const [title, setTitle] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [detectedType, setDetectedType] = useState<DetectedType>(null);
    const [currentStep, setCurrentStep] = useState<ProgressStep | null>(null);
    const [success, setSuccess] = useState(false);
    const [lectureId, setLectureId] = useState<string | null>(null);
    const [statusCheck, setStatusCheck] = useState(false);

    // Poll for lecture status after creating it
    useEffect(() => {
        if (!statusCheck || !lectureId) return;

        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`/api/process/status/${lectureId}`);
                if (!response.ok) return;

                const data = await response.json();
                
                if (data.status === "completed") {
                    clearInterval(pollInterval);
                    setSuccess(true);
                    setUrl("");
                    setTitle("");
                    setStatusCheck(false);
                    setTimeout(() => {
                        onSuccess(lectureId);
                    }, 800);
                } else if (data.status === "failed") {
                    clearInterval(pollInterval);
                    setError(data.error_message || "Processing failed");
                    onError(data.error_message || "Processing failed");
                    setStatusCheck(false);
                    setCurrentStep(null);
                } else if (data.status === "transcribing" && currentStep !== "transcribing") {
                    setCurrentStep("transcribing");
                } else if (data.status === "processing_rag" && currentStep === "transcribing") {
                    // Still in transcribing step UI, but we know RAG is processing
                }
            } catch (err) {
                // Silently continue polling
            }
        }, 1000); // Poll every 1 second

        return () => clearInterval(pollInterval);
    }, [statusCheck, lectureId, currentStep, onSuccess, onError]);

    // Detect link type in real-time
    const detectLinkType = (linkUrl: string): DetectedType => {
        if (!linkUrl) return null;
        if (linkUrl.includes("youtube.com") || linkUrl.includes("youtu.be")) return "youtube";
        if (linkUrl.includes("drive.google.com")) return "google-drive";
        return "unknown";
    };

    const handleUrlChange = (u: string) => {
        setUrl(u);
        setDetectedType(detectLinkType(u));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!url.trim()) {
            setError("Please enter a URL");
            return;
        }

        const type = detectLinkType(url);
        if (!type || type === "unknown") {
            setError("Please enter a valid YouTube or Google Drive link");
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            // Step 1: Detecting
            setCurrentStep("detecting");
            await new Promise(resolve => setTimeout(resolve, 500));

            // Step 2: Extracting
            setCurrentStep("extracting");

            const formData = new FormData();
            formData.append("url", url);
            if (title.trim()) formData.append("title", title);
            if (orgId) formData.append("org_id", orgId);
            if (groupId) formData.append("group_id", groupId);

            const response = await fetch("/api/process", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: "Unknown error", detail: "Failed to process link" }));
                const errorMessage = errorData.detail || errorData.message || `Failed to process link (${response.status})`;
                throw new Error(errorMessage);
            }

            // Step 3: Transcribing
            setCurrentStep("transcribing");
            const data = await response.json();

            // Start polling for status
            setLectureId(data.id || data.lecture_id || "");
            setStatusCheck(true);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Failed to process link";
            setError(errorMsg);
            onError(errorMsg);
            setCurrentStep(null);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="link-input-form">
            {/* URL Input */}
            <div className="link-input-wrapper">
                <label className="link-input-label">Link URL</label>
                <div className="link-input-container">
                    <input
                        type="url"
                        className="link-input-field"
                        placeholder="https://youtube.com/watch?v=... or https://drive.google.com/..."
                        value={url}
                        onChange={(e) => handleUrlChange(e.target.value)}
                        disabled={loading}
                        autoFocus
                    />
                    {detectedType && detectedType !== "unknown" && (
                        <div className={`link-detect-badge ${detectedType}`}>
                            {detectedType === "youtube" ? "📺 YouTube" : "📁 Drive"}
                        </div>
                    )}
                </div>
            </div>

            {/* Title Input */}
            <div className="link-input-wrapper">
                <label className="link-input-label">Title (Optional)</label>
                <input
                    type="text"
                    className="link-input-title-field"
                    placeholder="Custom title (auto-detected if omitted)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={loading}
                />
            </div>

            {/* Progress Display */}
            {loading && (
                <div className="link-progress-wrapper">
                    <div className="link-progress-steps">
                        <div className={`link-progress-step ${currentStep === "detecting" ? "" : "completed"}`}>
                            <div className="link-progress-step-icon">
                                {currentStep !== "detecting" ? "✓" : <Search size={16} />}
                            </div>
                            <div className="link-progress-step-text">
                                🔍 Detecting link type...
                            </div>
                        </div>
                        <div className={`link-progress-step ${currentStep === "extracting" ? "" : currentStep === "detecting" ? "" : "completed"}`}>
                            <div className="link-progress-step-icon">
                                {currentStep === "extracting" ? (
                                    <div style={{ animation: "spin 1s linear infinite" }}>⚙️</div>
                                ) : currentStep === "detecting" ? (
                                    ""
                                ) : (
                                    "✓"
                                )}
                            </div>
                            <div className="link-progress-step-text">
                                🎵 Extracting audio...
                            </div>
                        </div>
                        <div className={`link-progress-step ${currentStep === "transcribing" ? "" : ""}`}>
                            <div className="link-progress-step-icon">
                                {currentStep === "transcribing" ? (
                                    <div style={{ animation: "spin 1s linear infinite" }}>⚙️</div>
                                ) : (
                                    ""
                                )}
                            </div>
                            <div className="link-progress-step-text">
                                🤖 Transcribing with AI...
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Error Display */}
            {error && !loading && (
                <div className="link-error-box">
                    <div className="link-error-icon">
                        <AlertCircle size={18} />
                    </div>
                    <div className="link-error-text">{error}</div>
                </div>
            )}

            {/* Success Checkmark */}
            {success && !loading && (
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "12px 14px",
                    borderRadius: "var(--radius-md)",
                    background: "rgba(34, 197, 94, 0.1)",
                    border: "1px solid rgba(34, 197, 94, 0.3)",
                    color: "#22c55e",
                    fontSize: "0.85rem",
                    animation: "fadeIn 0.3s ease"
                }}>
                    <CheckCircle2 size={18} />
                    Link added successfully!
                </div>
            )}

            {/* Submit Button */}
            <div className="link-form-actions">
                <button
                    type="submit"
                    disabled={loading || !url.trim() || (detectedType === "unknown")}
                    className={`link-submit-btn ${success ? "success" : ""}`}
                >
                    {success ? (
                        <>
                            <CheckCircle2 size={18} />
                            Done
                        </>
                    ) : loading ? (
                        <>
                            <div style={{ animation: "spin 1s linear infinite" }}>⚙️</div>
                            Processing...
                        </>
                    ) : (
                        <>
                            Extract →
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}

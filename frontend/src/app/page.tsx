"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Mic, MessageSquare, Link2, FileEdit, CheckSquare, Tag, Upload, BarChart3, Zap, Lock, Users, Sparkles, ArrowRight, Clock, File, AlertCircle, Square } from "lucide-react";

const features = [
  { icon: FileText, title: "Document Intelligence", desc: "Index PDFs, DOCX, and PPTX to create a searchable company knowledge base.", color: "#00D4FF" },
  { icon: Mic, title: "Meeting Intelligence", desc: "Transcribe meeting audio/video with speaker-aware text extraction.", color: "#FF6B2B" },
  { icon: MessageSquare, title: "RAG Smart Querying", desc: "Ask natural-language questions and get grounded answers from internal data.", color: "#00D4FF" },
  { icon: Link2, title: "Source-Cited Answers", desc: "Return responses with source references so teams can verify quickly.", color: "#FF6B2B" },
  { icon: FileEdit, title: "Auto Summaries", desc: "Generate concise summaries and key points from long documents and meetings.", color: "#00D4FF" },
  { icon: CheckSquare, title: "Action Items", desc: "Extract tasks, owners, and follow-ups from meeting transcripts.", color: "#FF6B2B" },
  { icon: Tag, title: "Keyword & Topic Mining", desc: "Surface important entities, terms, and recurring topics across files.", color: "#00D4FF" },
  { icon: Upload, title: "Structured Export", desc: "Export results as PDF, Markdown, TXT, or JSON for downstream workflows.", color: "#FF6B2B" },
  { icon: BarChart3, title: "Usage Analytics", desc: "Track processing status, completion trends, and content volume insights.", color: "#00D4FF" },
  { icon: Zap, title: "Fast Retrieval", desc: "Vector search plus chunking gives high-signal answers with low latency.", color: "#FF6B2B" },
  { icon: Lock, title: "Private Workspace", desc: "Each user sees only their own uploaded assets and generated outputs.", color: "#00D4FF" },
  { icon: Users, title: "Slack-Ready Workflow", desc: "Designed for enterprise assistant flows and team collaboration use-cases.", color: "#FF6B2B" },
];

type InputType = "voice" | "document" | "video" | null;

interface LandingInputState {
  voice: { recording: boolean; duration: number; ready: boolean };
  document: { file: File | null; filename: string };
  video: { url: string };
}

export default function LandingPage() {
  const router = useRouter();
  const [showInputs, setShowInputs] = useState(false);
  const [inputState, setInputState] = useState<LandingInputState>({
    voice: { recording: false, duration: 0, ready: false },
    document: { file: null, filename: "" },
    video: { url: "" },
  });
  const [videoError, setVideoError] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const dragCounterRef = useRef(0);

  const hasAnyInput = inputState.voice.ready || inputState.document.file || (inputState.video.url && !videoError);

  // Clean up old pending summary flags when landing page loads
  useEffect(() => {
    localStorage.removeItem("pendingSummary_displayed");
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        setInputState((prev) => ({
          ...prev,
          voice: { ...prev.voice, ready: true, recording: false },
        }));
      };

      mediaRecorderRef.current.start();
      setInputState((prev) => ({
        ...prev,
        voice: { ...prev.voice, recording: true, duration: 0 },
      }));

      timerRef.current = setInterval(() => {
        setInputState((prev) => ({
          ...prev,
          voice: { ...prev.voice, duration: prev.voice.duration + 1 },
        }));
      }, 1000);
    } catch (err) {
      console.error("Failed to start recording:", err);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
  };

  const handleResetRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setInputState((prev) => ({
      ...prev,
      voice: { recording: false, duration: 0, ready: false },
    }));
    audioChunksRef.current = [];
  };

  const handleDocumentDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter") {
      dragCounterRef.current += 1;
    } else if (e.type === "dragleave") {
      dragCounterRef.current -= 1;
    }
  };

  const handleDocumentDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const validExts = ["pdf", "docx", "txt"];
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (validExts.includes(ext || "")) {
        setInputState((prev) => ({
          ...prev,
          document: { file, filename: file.name },
        }));
      }
    }
  };

  const handleDocumentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      const file = files[0];
      setInputState((prev) => ({
        ...prev,
        document: { file, filename: file.name },
      }));
    }
  };

  const validateVideoUrl = (url: string) => {
    try {
      new URL(url);
      if (url.includes("youtube.com") || url.includes("youtu.be") || url.includes("vimeo.com")) {
        setVideoError("");
        return true;
      } else {
        setVideoError("Only YouTube and Vimeo links are supported");
        return false;
      }
    } catch {
      setVideoError("Please enter a valid URL");
      return false;
    }
  };

  const handleVideoBlur = () => {
    if (inputState.video.url) {
      validateVideoUrl(inputState.video.url);
    }
  };

  const handleSummarizeNow = async () => {
    try {
      // Prepare data to pass - need to serialize audio and file as base64
      const data: any = {
        voice: null,
        document: null,
        video: null,
      };

      // Store voice recording as base64
      if (inputState.voice.ready && audioChunksRef.current.length > 0) {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          data.voice = {
            type: "voice",
            duration: inputState.voice.duration,
            audioBase64: base64,
          };
          continueToProcessing(data);
        };
        reader.readAsDataURL(audioBlob);
        return;
      }

      // Store document file as base64
      if (inputState.document.file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          data.document = {
            type: "document",
            filename: inputState.document.filename,
            fileBase64: base64,
            mimeType: inputState.document.file!.type,
          };
          continueToProcessing(data);
        };
        reader.readAsDataURL(inputState.document.file);
        return;
      }

      // Store video URL directly
      if (inputState.video.url && !videoError) {
        data.video = {
          type: "video",
          url: inputState.video.url,
        };
      }

      continueToProcessing(data);
    } catch (err) {
      console.error("Error preparing summary:", err);
    }
  };

  const continueToProcessing = (data: any) => {
    // Store in localStorage to pass through processing page to dashboard
    localStorage.setItem("pendingSummary", JSON.stringify(data));
    // Navigate to processing page
    router.push("/processing");
  };

  return (
    <div className="landing">
      <nav className="landing-nav">
        <div className="landing-logo">SyncMind AI</div>
        <div className="landing-nav-links">
          <Link href="/login" className="btn btn-ghost">Log In</Link>
          <Link href="/register" className="btn btn-primary">Get Started</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-badge"><Sparkles size={14} /> GenAI for Smart Knowledge Management</div>
        <h1>
          Turn Scattered Company Data Into<br />
          <span className="gradient-text">Instant Team Knowledge</span>
        </h1>
        <div className="hero-actions">
          <button className="btn btn-primary btn-lg" onClick={() => setShowInputs(true)}>
            Create Summary <ArrowRight size={18} />
          </button>
          <Link href="/register" className="btn btn-secondary btn-lg">Get Started</Link>
        </div>
      </section>

      {showInputs && (
        <section className="input-cards-section">
          <h2 style={{ marginBottom: "32px", textAlign: "center" }}>Choose your source</h2>
          <div className="input-cards-grid">
            {/* Record Voice */}
            <div className="input-card">
              <div className="input-card-header">
                <Mic size={20} style={{ color: "var(--primary-400)" }} />
                <h3>Record Voice</h3>
              </div>
              <div className="input-card-content">
                {!inputState.voice.ready ? (
                  <>
                    {inputState.voice.recording ? (
                      <>
                        <div className="recording-indicator" style={{ marginBottom: "12px" }}>
                          <span className="recording-dot" />
                          Recording...
                        </div>
                        <div className="timer">{formatTime(inputState.voice.duration)}</div>
                      </>
                    ) : (
                      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "12px" }}>
                        Click to start recording
                      </p>
                    )}
                    <div className="recording-buttons" style={{ display: "flex", gap: "8px" }}>
                      {!inputState.voice.recording ? (
                        <button className="btn btn-primary btn-sm" onClick={handleStartRecording}>
                          <Mic size={14} /> Start Recording
                        </button>
                      ) : (
                        <button className="btn btn-danger btn-sm" onClick={handleStopRecording}>
                          <Square size={14} /> Stop
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                      <CheckSquare size={16} style={{ color: "var(--primary-400)" }} />
                      <span>Recording ready ({formatTime(inputState.voice.duration)})</span>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={handleResetRecording}>
                      Reset
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Upload Document */}
            <div className="input-card">
              <div className="input-card-header">
                <File size={20} style={{ color: "var(--accent-400)" }} />
                <h3>Upload Document</h3>
              </div>
              <div className="input-card-content">
                {!inputState.document.file ? (
                  <label
                    className="drag-drop-zone"
                    onDragEnter={handleDocumentDrag}
                    onDragLeave={handleDocumentDrag}
                    onDrop={handleDocumentDrop}
                    onDragOver={(e) => e.preventDefault()}
                  >
                    <Upload size={24} style={{ color: "var(--accent-400)", opacity: 0.6 }} />
                    <p style={{ fontSize: "0.9rem", marginTop: "8px" }}>Drag and drop or click</p>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                      PDF, DOCX, or TXT
                    </p>
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt"
                      onChange={handleDocumentSelect}
                      style={{ display: "none" }}
                    />
                  </label>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                      <CheckSquare size={16} style={{ color: "var(--accent-400)" }} />
                      <span style={{ fontSize: "0.9rem", wordBreak: "break-all" }}>
                        {inputState.document.filename}
                      </span>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setInputState((prev) => ({ ...prev, document: { file: null, filename: "" } }))}
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Video Link */}
            <div className="input-card">
              <div className="input-card-header">
                <Link2 size={20} style={{ color: "#FF9500" }} />
                <h3>Video Link</h3>
              </div>
              <div className="input-card-content">
                <input
                  type="text"
                  placeholder="Paste YouTube or Vimeo link"
                  className="input"
                  value={inputState.video.url}
                  onChange={(e) => {
                    setInputState((prev) => ({
                      ...prev,
                      video: { url: e.target.value },
                    }));
                    setVideoError("");
                  }}
                  onBlur={handleVideoBlur}
                  style={{ marginBottom: videoError ? "8px" : "0" }}
                />
                {videoError && (
                  <div style={{ display: "flex", gap: "6px", alignItems: "flex-start", color: "var(--danger-400)", fontSize: "0.8rem" }}>
                    <AlertCircle size={14} style={{ marginTop: "2px", flexShrink: 0 }} />
                    <span>{videoError}</span>
                  </div>
                )}
                {inputState.video.url && !videoError && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                    <CheckSquare size={14} style={{ color: "var(--primary-400)" }} />
                    <span>URL is valid</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="input-actions" style={{ marginTop: "32px", display: "flex", gap: "12px", justifyContent: "center" }}>
            <button className="btn btn-ghost" onClick={() => setShowInputs(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary btn-lg"
              disabled={!hasAnyInput}
              onClick={handleSummarizeNow}
            >
              <Sparkles size={16} /> Summarize Now
            </button>
          </div>
        </section>
      )}

      <section className="features-section">
        <h2>Everything You Need to <span className="gradient-text">Automate Knowledge Work</span></h2>
        <div className="features-grid">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div key={i} className="feature-card" style={{ animationDelay: `${i * 0.05}s` }}>
                <span className="feature-icon" style={{ background: `${f.color}18`, color: f.color, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 12 }}>
                  <Icon size={22} />
                </span>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      <footer style={{ textAlign: "center", padding: "40px 20px", borderTop: "1px solid var(--border-subtle)", color: "var(--text-muted)", fontSize: "0.85rem", position: "relative", zIndex: 1 }}>
        <p>Built for enterprise teams with RAG, meeting intelligence, and document automation.</p>
      </footer>
    </div>
  );
}

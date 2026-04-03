import Link from "next/link";
import { FileText, Mic, MessageSquare, Link2, FileEdit, CheckSquare, Tag, Upload, BarChart3, Zap, Lock, Users, Sparkles, ArrowRight } from "lucide-react";

const features = [
  { icon: FileText, title: "Document Intelligence", desc: "Index PDFs, DOCX, and PPTX to create a searchable company knowledge base.", color: "#6366f1" },
  { icon: Mic, title: "Meeting Intelligence", desc: "Transcribe meeting audio/video with speaker-aware text extraction.", color: "#8b5cf6" },
  { icon: MessageSquare, title: "RAG Smart Querying", desc: "Ask natural-language questions and get grounded answers from internal data.", color: "#a855f7" },
  { icon: Link2, title: "Source-Cited Answers", desc: "Return responses with source references so teams can verify quickly.", color: "#ec4899" },
  { icon: FileEdit, title: "Auto Summaries", desc: "Generate concise summaries and key points from long documents and meetings.", color: "#10b981" },
  { icon: CheckSquare, title: "Action Items", desc: "Extract tasks, owners, and follow-ups from meeting transcripts.", color: "#14b8a6" },
  { icon: Tag, title: "Keyword & Topic Mining", desc: "Surface important entities, terms, and recurring topics across files.", color: "#f59e0b" },
  { icon: Upload, title: "Structured Export", desc: "Export results as PDF, Markdown, TXT, or JSON for downstream workflows.", color: "#ef4444" },
  { icon: BarChart3, title: "Usage Analytics", desc: "Track processing status, completion trends, and content volume insights.", color: "#3b82f6" },
  { icon: Zap, title: "Fast Retrieval", desc: "Vector search plus chunking gives high-signal answers with low latency.", color: "#f97316" },
  { icon: Lock, title: "Private Workspace", desc: "Each user sees only their own uploaded assets and generated outputs.", color: "#6366f1" },
  { icon: Users, title: "Slack-Ready Workflow", desc: "Designed for enterprise assistant flows and team collaboration use-cases.", color: "#8b5cf6" },
];

export default function LandingPage() {
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
        <p className="hero-subtitle">
          Upload PDFs, DOCX, PPTX, audio, and video; generate transcripts,
          summaries, action items, and RAG-powered answers in one platform.
        </p>
        <div className="hero-actions">
          <Link href="/register" className="btn btn-primary btn-lg">Start For Free <ArrowRight size={18} /></Link>
          <Link href="/login" className="btn btn-secondary btn-lg">Sign In</Link>
        </div>
      </section>

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

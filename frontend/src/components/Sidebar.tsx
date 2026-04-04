"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, type ComponentType } from "react";
import { LayoutDashboard, Upload, Mic, BarChart3, LogOut, Menu, X, Building2, Users, Sparkles, Link2 } from "lucide-react";
import { organizationsAPI } from "@/lib/api";
import { WorkspaceSummary } from "@/types";
import LinkInput from "@/components/LinkInput";

interface SidebarLink {
    href: string;
    icon: ComponentType<{ size?: number }>;
    label: string;
    isVisible: (ctx: { hasWorkspace: boolean }) => boolean;
}

const navLinks: SidebarLink[] = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", isVisible: () => true },
    { href: "/organizations", icon: Building2, label: "Workspaces", isVisible: () => true },
    { href: "/groups", icon: Users, label: "Teams", isVisible: ({ hasWorkspace }) => hasWorkspace },
    { href: "/analytics", icon: BarChart3, label: "Analytics", isVisible: () => true },
];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [linkModalMessage, setLinkModalMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [userEmail] = useState(() => {
        if (typeof window === "undefined") return "";
        const storedUser = localStorage.getItem("salc_user");
        if (!storedUser) return "";
        try {
            const parsed = JSON.parse(storedUser) as { email?: string };
            return parsed.email || "";
        } catch {
            return "";
        }
    });
    const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);

    const hasWorkspace = workspaces.length > 0;

    useEffect(() => {
        const fetchWorkspaces = async () => {
            try {
                const res = await organizationsAPI.list();
                setWorkspaces(Array.isArray(res.data) ? res.data : []);
            } catch {
                setWorkspaces([]);
            }
        };

        fetchWorkspaces();
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("salc_token");
        localStorage.removeItem("salc_user");
        router.push("/login");
    };

    const isActiveRoute = (href: string) => {
        if (!pathname) return false;
        if (pathname === href) return true;
        if (pathname.startsWith(`${href}/`)) return true;

        // Treat lecture detail pages as part of the dashboard experience.
        if (href === "/dashboard" && pathname.startsWith("/lecture/")) return true;

        return false;
    };

    return (
        <>
            <button className="sidebar-toggle" onClick={() => setIsOpen(!isOpen)}>
                {isOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <div className={`sidebar-overlay ${isOpen ? "open" : ""}`} onClick={() => setIsOpen(false)} />

            <aside className={`sidebar ${isOpen ? "open" : ""}`}>
                <div className="sidebar-logo">SyncMind AI</div>

                <nav className="sidebar-nav">
                    {navLinks.filter((link) => link.isVisible({ hasWorkspace })).map((link) => {
                        const Icon = link.icon;
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`sidebar-link ${isActiveRoute(link.href) ? "active" : ""}`}
                                onClick={() => setIsOpen(false)}
                            >
                                <span className="sidebar-link-icon"><Icon size={18} /></span>
                                {link.label}
                            </Link>
                        );
                    })}

                    <div className="sidebar-divider" />
                    <div className="sidebar-section-title">Quick Create</div>
                    <Link
                        href="/upload"
                        className={`sidebar-link sidebar-link-subtle ${isActiveRoute("/upload") ? "active" : ""}`}
                        onClick={() => setIsOpen(false)}
                    >
                        <span className="sidebar-link-icon"><Upload size={18} /></span>
                        Upload Knowledge
                    </Link>
                    <Link
                        href="/record"
                        className={`sidebar-link sidebar-link-subtle ${isActiveRoute("/record") ? "active" : ""}`}
                        onClick={() => setIsOpen(false)}
                    >
                        <span className="sidebar-link-icon"><Mic size={18} /></span>
                        Record Meeting
                    </Link>
                    <button
                        className={`sidebar-link sidebar-link-subtle sidebar-link-button ${isLinkModalOpen ? "active" : ""}`}
                        onClick={() => setIsLinkModalOpen(true)}
                    >
                        <span className="sidebar-link-icon"><Link2 size={18} /></span>
                        Add Link
                    </button>
                </nav>

                <div className="sidebar-footer">
                    {!hasWorkspace && (
                        <div className="sidebar-footer-tip">Create a workspace to unlock Teams.</div>
                    )}
                    {userEmail && (
                        <div className="sidebar-user" style={{ marginBottom: "12px" }}>
                            <div className="sidebar-avatar">{userEmail[0]?.toUpperCase()}</div>
                            <div className="sidebar-user-info">
                                <div className="sidebar-user-email">{userEmail}</div>
                            </div>
                        </div>
                    )}
                    <button className="btn btn-ghost btn-sm" style={{ width: "100%" }} onClick={handleLogout}>
                        <LogOut size={16} /> Sign Out
                    </button>
                </div>
            </aside>

            {/* Link Input Modal */}
            {isLinkModalOpen && (
                <div className="modal-overlay" onClick={() => setIsLinkModalOpen(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <Link2 size={20} style={{ color: "#00D4FF" }} />
                                <span className="modal-title">Add Link</span>
                            </div>
                            <button className="modal-close" onClick={() => setIsLinkModalOpen(false)}>
                                ✕
                            </button>
                        </div>
                        <LinkInput
                            onSuccess={(lectureId) => {
                                setIsLinkModalOpen(false);
                                router.push(`/lecture/${lectureId}`);
                            }}
                            onError={(error) => {
                                setLinkModalMessage({ type: "error", text: error });
                            }}
                        />
                        {linkModalMessage && (
                            <div style={{
                                marginTop: "16px",
                                padding: "10px 12px",
                                borderRadius: "var(--radius-md)",
                                fontSize: "0.85rem",
                                background: linkModalMessage.type === "success" ? "rgba(34, 197, 94, 0.1)" : "rgba(255, 107, 43, 0.1)",
                                border: `1px solid ${linkModalMessage.type === "success" ? "rgba(34, 197, 94, 0.3)" : "rgba(255, 107, 43, 0.25)"}`,
                                color: linkModalMessage.type === "success" ? "#22c55e" : "#FF6B2B"
                            }}>
                                {linkModalMessage.text}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

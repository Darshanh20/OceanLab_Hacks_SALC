"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, type ComponentType } from "react";
import { LayoutDashboard, Upload, Mic, BarChart3, LogOut, Menu, X, Building2, Users, Sparkles } from "lucide-react";
import { organizationsAPI } from "@/lib/api";
import { AppRole, WorkspaceSummary } from "@/types";

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
    const hasManageRole = workspaces.some((workspace) => workspace.my_role === "owner" || workspace.my_role === "admin");
    const primaryRole: AppRole | null = workspaces.some((workspace) => workspace.my_role === "owner")
        ? "owner"
        : workspaces.some((workspace) => workspace.my_role === "admin")
            ? "admin"
            : workspaces.some((workspace) => workspace.my_role === "member")
                ? "member"
                : null;

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

    return (
        <>
            <button className="sidebar-toggle" onClick={() => setIsOpen(!isOpen)}>
                {isOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <div className={`sidebar-overlay ${isOpen ? "open" : ""}`} onClick={() => setIsOpen(false)} />

            <aside className={`sidebar ${isOpen ? "open" : ""}`}>
                <div className="sidebar-logo">SyncMind AI</div>

                <div className="sidebar-context">
                    {hasWorkspace ? (
                        <>
                            <div className="sidebar-context-label">Workspace Access</div>
                            <div className="sidebar-context-value">{workspaces.length} linked</div>
                            {primaryRole && (
                                <span className={`sidebar-role-pill role-${primaryRole}`}>
                                    {primaryRole.toUpperCase()}
                                </span>
                            )}
                        </>
                    ) : (
                        <>
                            <div className="sidebar-context-label">Workspace Access</div>
                            <div className="sidebar-context-value">Personal mode</div>
                        </>
                    )}
                </div>

                <nav className="sidebar-nav">
                    <div className="sidebar-section-title">Main</div>
                    {navLinks.filter((link) => link.isVisible({ hasWorkspace })).map((link) => {
                        const Icon = link.icon;
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`sidebar-link ${pathname === link.href ? "active" : ""}`}
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
                        className={`sidebar-link sidebar-link-subtle ${pathname === "/upload" ? "active" : ""}`}
                        onClick={() => setIsOpen(false)}
                    >
                        <span className="sidebar-link-icon"><Upload size={18} /></span>
                        Upload Knowledge
                    </Link>
                    <Link
                        href="/record"
                        className={`sidebar-link sidebar-link-subtle ${pathname === "/record" ? "active" : ""}`}
                        onClick={() => setIsOpen(false)}
                    >
                        <span className="sidebar-link-icon"><Mic size={18} /></span>
                        Record Meeting
                    </Link>
                </nav>

                <div className="sidebar-footer">
                    {!hasWorkspace && (
                        <div className="sidebar-footer-tip">Create a workspace to unlock Teams.</div>
                    )}
                    {hasWorkspace && hasManageRole && (
                        <div className="sidebar-footer-tip sidebar-footer-tip-accent"><Sparkles size={12} /> Manage-enabled workspace access</div>
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
        </>
    );
}

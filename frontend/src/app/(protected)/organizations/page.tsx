"use client";

import { useState, useEffect } from "react";
import { Plus, Building2, ArrowRight, Shield, Settings, Users, Trash2 } from "lucide-react";
import Link from "next/link";
import { organizationsAPI } from "@/lib/api";
import { AppRole } from "@/types";

interface Organization {
    id: string;
    name: string;
    subscription_tier: string;
    subscription_status: string;
    owner_id: string;
    created_at: string;
    my_role?: AppRole;
}

export default function OrganizationsPage() {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newOrgName, setNewOrgName] = useState("");
    const [roleFilter, setRoleFilter] = useState<"all" | AppRole>("all");
    const [deletingOrgId, setDeletingOrgId] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

    const filteredOrganizations = roleFilter === "all"
        ? organizations
        : organizations.filter((org) => org.my_role === roleFilter);

    useEffect(() => {
        fetchOrganizations();
    }, []);

    const fetchOrganizations = async () => {
        setLoading(true);
        try {
            const res = await organizationsAPI.list();
            setOrganizations(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error("Failed to fetch organizations:", error);
            setOrganizations([]);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateOrg = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = newOrgName.trim();
        if (!trimmedName) return;

        try {
            await organizationsAPI.create(trimmedName);
            setNewOrgName("");
            setShowCreateModal(false);
            fetchOrganizations();
        } catch (error) {
            console.error("Failed to create organization:", error);
        }
    };

    const handleDeleteOrg = async (orgId: string) => {
        setDeletingOrgId(orgId);
        try {
            await organizationsAPI.delete(orgId);
            setShowDeleteConfirm(null);
            setOrganizations((prev) => prev.filter((org) => org.id !== orgId));
        } catch (error) {
            console.error("Failed to delete organization:", error);
        } finally {
            setDeletingOrgId(null);
        }
    };

    return (
        <div className="container-fluid">
            <header className="page-header">
                <div>
                    <h1 className="page-title">Workspaces</h1>
                    <p className="page-subtitle">Centralize access, teams, and knowledge context in one workspace view</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                    <Plus size={18} /> Create Workspace
                </button>
            </header>

            {loading ? (
                <div className="flex-center" style={{ height: "300px" }}>
                    <div className="spinner" />
                </div>
            ) : organizations.length === 0 ? (
                <div className="card empty-state">
                    <div className="empty-state-icon">
                        <Building2 size={48} />
                    </div>
                    <h3>No Workspaces Yet</h3>
                    <p>Create your first workspace to start organizing teams and knowledge.</p>
                    <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                        Create Workspace
                    </button>
                </div>
            ) : (
                <>
                    <div className="dashboard-shell dashboard-shell-single" style={{ marginBottom: "18px" }}>
                        <div className="dashboard-panel dashboard-panel-filters">
                            <div className="dashboard-fields dashboard-fields-inline">
                                <label className="dashboard-field" style={{ minWidth: 260 }}>
                                    <span className="dashboard-field-label"><Users size={14} /> Role Filter</span>
                                    <select
                                        className="dashboard-select"
                                        value={roleFilter}
                                        onChange={(e) => setRoleFilter(e.target.value as "all" | AppRole)}
                                    >
                                        <option value="all">All Workspaces</option>
                                        <option value="owner">Owner</option>
                                        <option value="admin">Admin</option>
                                        <option value="member">Member</option>
                                    </select>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="entity-grid">
                    {filteredOrganizations.map((org) => (
                        <div key={org.id} className="card entity-card card-interactive">
                            <div className="card-body">
                                <div className="entity-header">
                                    <div className="entity-icon entity-icon-workspace">
                                        <Building2 size={24} />
                                    </div>
                                    <div className="entity-badge">{org.subscription_tier.toUpperCase()}</div>
                                </div>
                                <h3 className="entity-title">{org.name}</h3>
                                <div className="entity-meta-row">
                                    <div className="entity-meta-item">
                                        <Shield size={14} />
                                        <span>{org.subscription_status}</span>
                                    </div>
                                    {org.my_role && (
                                        <div className="entity-meta-item">
                                            <Settings size={14} />
                                            <span>Role: {org.my_role}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="entity-actions">
                                    <Link href={`/organizations/${org.id}`} className="btn btn-secondary btn-sm">
                                        Workspace Details <ArrowRight size={14} />
                                    </Link>
                                    <Link href={`/workspace-view/${org.id}`} className="btn btn-ghost btn-sm">
                                        Add or Upload to Team
                                    </Link>
                                    {org.my_role?.toLowerCase() === "owner" && (
                                        <button
                                            className="btn btn-danger-soft btn-sm"
                                            onClick={() => setShowDeleteConfirm(org.id)}
                                            title="Delete workspace"
                                        >
                                            <Trash2 size={14} /> Delete Workspace
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    </div>

                    {filteredOrganizations.length === 0 && (
                        <div className="card empty-state" style={{ marginTop: "12px" }}>
                            <h3>No workspaces for this role</h3>
                            <p>Try selecting a different role filter.</p>
                        </div>
                    )}
                </>
            )}

            {showCreateModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2 className="modal-title">Create Workspace</h2>
                            <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                                &times;
                            </button>
                        </div>
                        <form onSubmit={handleCreateOrg}>
                            <div className="form-group">
                                <label className="form-label">Workspace Name</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="e.g. Acme Corp"
                                    value={newOrgName}
                                    onChange={(e) => setNewOrgName(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowCreateModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Create Workspace
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showDeleteConfirm && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: "420px" }}>
                        <div className="modal-header">
                            <h2 className="modal-title">Delete Workspace</h2>
                            <button className="modal-close" onClick={() => setShowDeleteConfirm(null)}>
                                &times;
                            </button>
                        </div>
                        <div className="modal-body" style={{ padding: "16px 24px", marginBottom: "16px" }}>
                            <p style={{ margin: 0, color: "#e2e8f0" }}>
                                Are you sure you want to delete this workspace? This action is permanent and cannot be undone.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() => setShowDeleteConfirm(null)}
                                disabled={deletingOrgId === showDeleteConfirm}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-danger"
                                onClick={() => handleDeleteOrg(showDeleteConfirm)}
                                disabled={deletingOrgId === showDeleteConfirm}
                            >
                                {deletingOrgId === showDeleteConfirm ? "Deleting..." : "Delete Workspace"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

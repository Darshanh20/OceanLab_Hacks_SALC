"use client";

import { useEffect, useState } from "react";
import { Plus, Users, ArrowRight, Info, Search, Building2 } from "lucide-react";
import Link from "next/link";
import { groupsAPI, organizationsAPI } from "@/lib/api";
import { AppRole } from "@/types";

interface Group {
    id: string;
    org_id: string;
    name: string;
    description: string;
    created_at: string;
}

interface Organization {
    id: string;
    name: string;
    my_role?: AppRole;
}

export default function GroupsPage() {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [selectedOrgId, setSelectedOrgId] = useState("");
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [newGroupDesc, setNewGroupDesc] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    const selectedOrgRole = organizations.find((org) => org.id === selectedOrgId)?.my_role;
    const canCreateGroup = selectedOrgRole === "owner" || selectedOrgRole === "admin";

    const filteredGroups = groups.filter((group) => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return (
            group.name.toLowerCase().includes(query) ||
            (group.description || "").toLowerCase().includes(query)
        );
    });

    useEffect(() => {
        const fetchOrganizations = async () => {
            try {
                const res = await organizationsAPI.list();
                const data: Organization[] = Array.isArray(res.data) ? res.data : [];
                setOrganizations(data);
                if (data.length > 0) {
                    setSelectedOrgId(data[0].id);
                }
            } catch (error) {
                console.error("Failed to fetch organizations:", error);
                setOrganizations([]);
            }
        };

        fetchOrganizations();
    }, []);

    useEffect(() => {
        const fetchGroups = async () => {
            if (!selectedOrgId) {
                setGroups([]);
                return;
            }

            setLoading(true);
            try {
                const res = await groupsAPI.listByOrg(selectedOrgId);
                setGroups(Array.isArray(res.data) ? res.data : []);
            } catch (error) {
                console.error("Failed to fetch groups:", error);
                setGroups([]);
            } finally {
                setLoading(false);
            }
        };

        fetchGroups();
    }, [selectedOrgId]);

    const handleCreateGroup = async (e: React.FormEvent) => {
        e.preventDefault();

        const trimmedName = newGroupName.trim();
        if (!trimmedName || !selectedOrgId || !canCreateGroup) return;

        try {
            await groupsAPI.create(selectedOrgId, trimmedName, newGroupDesc.trim() || undefined);
            setNewGroupName("");
            setNewGroupDesc("");
            setShowCreateModal(false);

            const res = await groupsAPI.listByOrg(selectedOrgId);
            setGroups(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error("Failed to create group:", error);
        }
    };

    return (
        <div className="container-fluid">
            <header className="page-header">
                <div>
                    <h1 className="page-title">Teams</h1>
                    <p className="page-subtitle">Create focused collaboration spaces inside each workspace</p>
                </div>
                {selectedOrgId && canCreateGroup && (
                    <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                        <Plus size={18} /> New Team
                    </button>
                )}
            </header>

            <div className="dashboard-shell dashboard-shell-single">
                <div className="dashboard-panel dashboard-panel-filters">
                    <div className="dashboard-fields dashboard-fields-inline">
                        <label className="dashboard-field">
                            <span className="dashboard-field-label"><Building2 size={14} /> Active Workspace</span>
                            <select
                                className="dashboard-select"
                                value={selectedOrgId}
                                onChange={(e) => setSelectedOrgId(e.target.value)}
                            >
                                {organizations.map((org) => (
                                    <option key={org.id} value={org.id}>{org.name}</option>
                                ))}
                                {organizations.length === 0 && <option value="">No Workspaces Found</option>}
                            </select>
                        </label>

                        <label className="dashboard-field dashboard-field-search">
                            <span className="dashboard-field-label"><Search size={14} /> Search Teams</span>
                            <input
                                type="text"
                                placeholder="Search by name or description"
                                className="dashboard-input"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </label>
                    </div>

                </div>
            </div>

            {loading ? (
                <div className="flex-center" style={{ height: "300px" }}>
                    <div className="spinner" />
                </div>
            ) : filteredGroups.length === 0 ? (
                <div className="card empty-state">
                    <div className="empty-state-icon">
                        <Users size={48} />
                    </div>
                    <h3>{groups.length === 0 ? "No Teams in this Workspace" : "No teams match your search"}</h3>
                    <p>
                        {groups.length === 0
                            ? "Create teams to share knowledge with the right members in the workspace."
                            : "Try a different search term or clear the filter."}
                    </p>
                    {selectedOrgId && canCreateGroup && groups.length === 0 && (
                        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                            Create First Team
                        </button>
                    )}
                </div>
            ) : (
                <div className="entity-grid">
                    {filteredGroups.map((group) => (
                        <div key={group.id} className="card entity-card card-interactive">
                            <div className="card-body">
                                <div className="entity-header">
                                    <h3 className="entity-title">{group.name}</h3>
                                    <span className="entity-badge">Active</span>
                                </div>
                                <p className="entity-description">{group.description || "No description provided."}</p>
                                <div className="entity-footer">
                                    <div className="entity-meta-item">
                                        <Info size={14} />
                                        <span>Created {new Date(group.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <Link href={`/groups/${group.id}`} className="entity-link">
                                        Team Details <ArrowRight size={14} />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showCreateModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2 className="modal-title">Create New Team</h2>
                            <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                                &times;
                            </button>
                        </div>
                        <form onSubmit={handleCreateGroup}>
                            <div className="form-group">
                                <label className="form-label">Team Name</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="e.g. Engineering Team"
                                    value={newGroupName}
                                    onChange={(e) => setNewGroupName(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description (Optional)</label>
                                <textarea
                                    className="textarea"
                                    placeholder="What is this team for?"
                                    value={newGroupDesc}
                                    onChange={(e) => setNewGroupDesc(e.target.value)}
                                    rows={3}
                                />
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowCreateModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Create Team
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

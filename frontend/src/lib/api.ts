import axios from "axios";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
    baseURL: API_URL,
});

// Attach JWT token to requests
api.interceptors.request.use((config) => {
    if (typeof window !== "undefined") {
        const token = localStorage.getItem("salc_token");
        if (token) {
            config.headers = config.headers ?? {};
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});

// Handle 401 globally
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && typeof window !== "undefined") {
            localStorage.removeItem("salc_token");
            localStorage.removeItem("salc_user");
            window.location.href = "/login";
        }
        return Promise.reject(error);
    },
);

export const authAPI = {
    register: (email: string, password: string) =>
        api.post("/api/auth/register", { email, password }),
    login: (email: string, password: string) =>
        api.post("/api/auth/login", { email, password }),
    me: () => api.get("/api/auth/me"),
};

export const lecturesAPI = {
    list: (org_id?: string, group_id?: string) => 
        api.get("/api/lectures", { params: { org_id, group_id } }),
    get: (id: string) => api.get(`/api/lectures/${id}`),
    suggestTeams: (id: string) => api.get(`/api/lectures/${id}/suggest-teams`),
    shareTeams: (id: string, team_ids: string[]) =>
        api.put(`/api/lectures/${id}/share-teams`, { team_ids }),
    upload: (formData: FormData) =>
        api.post("/api/lectures/upload", formData, {
            headers: { "Content-Type": "multipart/form-data" },
            timeout: 300000,
        }),
    delete: (id: string) => api.delete(`/api/lectures/${id}`),
    uploadurl: (formData: FormData) =>
        api.post("/api/lectures/upload-url", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        }),
    confirmupload: (formData: FormData) =>
        api.post("/api/lectures/confirm-upload", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        }),
};

export const organizationsAPI = {
    list: () => api.get("/api/organizations"),
    create: (name: string) => api.post("/api/organizations", { name }),
    delete: (orgId: string) => api.delete(`/api/organizations/${orgId}`),
    getMembers: (orgId: string) => api.get(`/api/organizations/${orgId}/members`),
    getRole: (orgId: string) => api.get(`/api/organizations/${orgId}/role`),
    getInvites: (orgId: string) => api.get(`/api/organizations/${orgId}/invites`),
    getPendingInvitations: () => api.get("/api/organizations/pending-invitations"),
    invite: (orgId: string, email: string, role: string = "member") =>
        api.post(`/api/organizations/${orgId}/invite`, { email, role }),
    removeMember: (orgId: string, userId: string) =>
        api.delete(`/api/organizations/${orgId}/members/${userId}`),
};

export const groupsAPI = {
    listByOrg: (orgId: string) => api.get(`/api/groups/org/${orgId}`),
    get: (groupId: string) => api.get(`/api/groups/${groupId}`),
    delete: (groupId: string) => api.delete(`/api/groups/${groupId}`),
    getMembers: (groupId: string) => api.get(`/api/groups/${groupId}/members`),
    create: (org_id: string, name: string, description?: string) =>
        api.post("/api/groups", { org_id, name, description }),
    addMember: (groupId: string, userId: string, role: string = "member") =>
        api.post(`/api/groups/${groupId}/members`, { user_id: userId, role }),
    removeMember: (groupId: string, userId: string) =>
        api.delete(`/api/groups/${groupId}/members/${userId}`),
};

export const chatAPI = {
    ask: (lectureId: string, question: string) =>
        api.post(`/api/lectures/${lectureId}/chat`, { question }),
};

export const analysisAPI = {
    summary: (lectureId: string, formatType: string = "detailed", refresh: boolean = false) =>
        api.post("/api/analysis/summary", {
            lecture_id: lectureId,
            format_type: formatType,
            refresh,
        }),
    notes: (lectureId: string, refresh: boolean = false) =>
        api.post("/api/analysis/notes", { lecture_id: lectureId, refresh }),
    keywords: (lectureId: string, refresh: boolean = false) =>
        api.post("/api/analysis/keywords", { lecture_id: lectureId, refresh }),
    questions: (lectureId: string, formatType: string = "mixed", refresh: boolean = false) =>
        api.post("/api/analysis/questions", {
            lecture_id: lectureId,
            format_type: formatType,
            refresh,
        }),
    topics: (lectureId: string, refresh: boolean = false) =>
        api.post("/api/analysis/topics", { lecture_id: lectureId, refresh }),
    highlights: (lectureId: string, refresh: boolean = false) =>
        api.post("/api/analysis/highlights", { lecture_id: lectureId, refresh }),
    translate: (lectureId: string, content: string, targetLanguage: string) =>
        api.post("/api/analysis/translate", {
            lecture_id: lectureId,
            content,
            target_language: targetLanguage,
        }),
    actionPlan: (lectureId: string, forceRefresh: boolean = false) =>
        api.post("/api/analysis/action-plan", {
            lecture_id: lectureId,
            force_refresh: forceRefresh,
        }),
    actionPlanTasks: (lectureId: string) =>
        api.post("/api/analysis/action-plan/tasks", { lecture_id: lectureId }),
    actionPlanTimeline: (lectureId: string) =>
        api.post("/api/analysis/action-plan/timeline", { lecture_id: lectureId }),
    actionPlanDependencies: (lectureId: string) =>
        api.post("/api/analysis/action-plan/dependencies", { lecture_id: lectureId }),
    actionPlanTeamBreakdown: (lectureId: string) =>
        api.post("/api/analysis/action-plan/team-breakdown", { lecture_id: lectureId }),
    actionPlanMarkdown: (lectureId: string) =>
        api.post("/api/analysis/action-plan/markdown", { lecture_id: lectureId }),
    workspaceActionPlan: (orgId: string, groupId?: string, forceRefresh: boolean = false) =>
        api.post("/api/analysis/workspace-action-plan", {
            org_id: orgId,
            group_id: groupId,
            force_refresh: forceRefresh,
        }),
    dates: (lectureId: string) =>
        api.post("/api/analysis/dates", { lecture_id: lectureId }),
};

export const exportAPI = {
    pdf: (lectureId: string) =>
        api.post(
            "/api/export/pdf",
            { lecture_id: lectureId },
            { responseType: "blob" },
        ),
    markdown: (lectureId: string) =>
        api.post(
            "/api/export/markdown",
            { lecture_id: lectureId },
            { responseType: "blob" },
        ),
    txt: (lectureId: string) =>
        api.post(
            "/api/export/txt",
            { lecture_id: lectureId },
            { responseType: "blob" },
        ),
    json: (lectureId: string) =>
        api.post(
            "/api/export/json",
            { lecture_id: lectureId },
            { responseType: "blob" },
        ),
};

export default api;

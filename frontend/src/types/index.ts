export interface User {
    id: string;
    email: string;
    role?: AppRole;
    created_at?: string;
}

export type AppRole = "owner" | "admin" | "member";

export interface WorkspaceSummary {
    id: string;
    name: string;
    my_role?: AppRole;
}

export interface AuthResponse {
    access_token: string;
    token_type: string;
    user: User;
}

export interface Utterance {
    speaker: number;
    start: number;
    end: number;
    text: string;
}

export interface TranscriptData {
    utterances: Utterance[];
    speaker_labels: Record<string, string>;
    detected_language: string;
    duration_seconds: number;
    word_count: number;
}

export interface Lecture {
    id: string;
    user_id: string;
    title: string;
    audio_url?: string;
    transcript_text?: string;
    transcript_json?: string; // JSON string of TranscriptData
    summary_text?: string;
    status: string;
    created_at?: string;
    org_id?: string;
    group_id?: string;
}

export interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    sources?: string[];
    timestamp: Date;
}

export interface AnalysisResponse {
    content: string;
    analysis_type: string;
}

export interface ActionTask {
    id: string;
    title: string;
    description: string;
    team: string;
    owner: string;
    priority: "high" | "medium" | "low";
    deadline: string;
    status: "todo" | "in_progress" | "blocked" | "done";
    dependencies: string[];
}

export interface ActionPlanJson {
    summary: string;
    tasks: ActionTask[];
    teams: Record<string, string>;
}

export interface ActionPlanSectionResponse {
    content: string;
    content_json: any;
    cached: boolean;
}

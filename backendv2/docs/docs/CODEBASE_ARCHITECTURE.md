# Codebase Architecture Summary

## Overview
This is a B2B Knowledge Management platform with:
- **Team collaboration**: Organizations → Teams (Groups) → Members
- **Transcript processing**: Audio/video/documents → (Deepgram/text extraction) → Structured data + RAG embeddings
- **Content sharing**: Role-based permissions (organization-level and team-level)
- **AI services**: RAG-based Q&A, summaries, analysis tools

## Recommended Modular Structure

The current codebase is still organized as routers/services/models/middleware. The target structure should be feature-first and layer-aware:

### Backend target layout
```bash
backend/app/
├── core/
│   ├── config.py
│   ├── database.py
│   └── security.py
├── modules/
│   ├── auth/
│   ├── lectures/
│   ├── ingestion/
│   ├── live_sessions/
│   ├── rag/
│   ├── analysis/
│   ├── tasks/
│   ├── organizations/
│   ├── groups/
│   └── integrations/
├── shared/
│   ├── ai/
│   ├── utils/
│   └── constants.py
├── workers/
└── main.py
```

### Feature module contract
Each module should keep the same internal layers:
- `router.py` for HTTP endpoints
- `service.py` for business logic
- `repository.py` for database access
- `schema.py` for Pydantic models
- `utils.py` or handlers for feature-specific helpers

### Current file mapping
- `routers/auth.py` + `services/auth_service.py` → `modules/auth/`
- `routers/lectures.py` + `services/transcription_service.py` + `services/document_extraction_service.py` → `modules/lectures/` and `modules/ingestion/`
- `routers/chat.py` + `services/rag_service.py` → `modules/rag/`
- `routers/analysis.py` + `services/analysis_service.py` + `services/summary_service.py` → `modules/analysis/`
- `routers/organizations.py` + `services/organization_service.py` → `modules/organizations/`
- `routers/groups.py` + `services/group_service.py` → `modules/groups/`
- `services/team_suggestion_service.py` → `modules/integrations/` or `modules/lectures/` depending on ownership
- `services/supabase_client.py` + `config.py` + `middleware/auth_middleware.py` → `core/`

### Frontend target layout
```bash
frontend/src/
├── app/
├── modules/
│   ├── ingestion/
│   ├── lectures/
│   ├── tasks/
│   ├── chat/
│   └── auth/
├── components/
├── lib/
├── store/
├── styles/
└── types/
```

This structure keeps each feature self-contained and makes it easier to add new verticals like live sessions, tasks, or calendar integrations without spreading logic across unrelated folders.

---

## 1. TRANSCRIPT HANDLING

### Database Schema
**Core tables** (from `migration.sql` + `b2b_migration.sql`):
- `lectures` (main transcript store)
  - `id`, `user_id`, `title`, `status`
  - `audio_url` (Supabase Storage URL)
  - `transcript_text` (full plain text)
  - `transcript_json` (structured: utterances, speaker labels, timestamps, duration, word count)
  - `summary_text` (cached summary)
  - `org_id`, `group_id` (ownership/scoping)
  - `created_at`

- `lecture_chunks` (RAG embeddings)
  - `id`, `lecture_id`, `chunk_text`
  - `embedding` (vector(1024) from Cohere)

- `lecture_analysis` (cached analyses)
  - `lecture_id`, `analysis_type`, `content`

- `lecture_team_shares` (secondary team sharing)
  - `lecture_id`, `group_id`, `shared_at`

- `lecture_action_plans` (lecture-level planning cache)
  - `lecture_id`, `markdown_content`, `content_json`, `tasks_json`, `timeline_json`, `dependencies_json`, `team_breakdown_json`, `share_team_ids_json`, `is_shared`

- `workspace_action_plans` (org/team planning cache)
  - `org_id`, `group_id`, `markdown_content`, `content_json`, `tasks_json`, `timeline_json`, `dependencies_json`, `team_breakdown_json`, `risks_json`

### Processing Pipeline
**File upload flow** (`routers/lectures.py` → `_upload_and_process_lecture`):
1. **Upload**: File → Supabase Storage (`lecture-audio`) → Public URL
2. **Transcribe** (status: "transcribing")
   - **Audio/Video**: Deepgram API (nova-2) with:
     - Speaker diarization (multi-speaker detection)
     - Word-level timestamps
     - Utterance-level timestamps
     - Language detection
     - Punctuation/smart formatting
     - Returns: `transcript_text`, `utterances[]`, `speaker_labels{}`, `duration_seconds`, `word_count`
   - **Documents** (PDF/DOCX/PPTX): Text extraction (no OCR) → treated as transcript
3. **Summarize** (status: "summarizing")
   - Groq API generates summary (cached in `lecture_analysis`)
4. **RAG Processing** (status: "processing_rag")
   - Chunk transcript (~500-800 tokens, overlapping)
  - Generate embeddings via Cohere API (embed-english-v3.0, 1024-dim vectors)
   - Store in `lecture_chunks` table
5. **Complete** (status: "completed")

### Access Control
```python
# From chat.py and analysis.py (same logic)
- Personal lecture (no org_id):     only uploader can access
- Workspace lecture (org_id only):  any org member can access
- Team lecture (org_id + group_id): team members + org admins/owner can access
```

---

## 2. TEAM/ORGANIZATION STRUCTURE

### Database Schema
**Organizations (Workspaces)**:
- `organizations` table
  - `id`, `name`, `owner_id`, `subscription_tier` (free/pro/enterprise), `subscription_status`
  
- `org_members` table
  - `org_id`, `user_id`, `role` (owner/admin/member), `joined_at`
  - Unique constraint: (org_id, user_id)

**Teams/Groups**:
- `groups` table
  - `id`, `org_id`, `name`, `description`, `created_by`, `created_at`
  
- `group_members` table
  - `group_id`, `user_id`, `role` (admin/member), `joined_at`
  - Unique constraint: (group_id, user_id)

### Hierarchy
```
Workspace (Organization)
├── Member (org_members table)
│   ├── Role: owner, admin, or member
│   └── Can be in multiple Teams
└── Team (Groups)
    └── Team Members (group_members table)
        └── Role: admin or member
```

### Role Permissions

**Organization Level**:
- **Owner**: Can create/delete org, invite/remove members, manage admins
- **Admin**: Can create teams, invite members to org, manage team memberships
- **Member**: Can view workspace and assigned teams

**Team Level**:
- **Admin**: Can add/remove members from team
- **Member**: Can view and access team content

**Cross-role logic** (from `group_service.py`):
- Org owner/admin automatically get team admin role if added to a team
- Org admins can manage all team content
- Regular members need explicit team membership

---

## 3. SHARING & PERMISSIONS SYSTEM

### Implementation
All permission checks in backend routers use:
- `_can_access_lecture(lecture: dict, user_id: str) → bool`
  - Checks org membership + team membership rules
  - Used by: `chat.py`, `analysis.py`, `lectures.py`

### Sharing Flow
1. **Upload with scope**:
   - Personal: `org_id=None, group_id=None` → private
   - Workspace: `org_id=<id>, group_id=None` → all org members
   - Team: `org_id=<id>, group_id=<id>` → team members only
  - Multi-team distribution: additional teams are added to `lecture_team_shares`

2. **Access endpoints** enforced:
   - `/api/lectures` - list (filtered by access)
   - `/api/lectures/{id}/chat` - Q&A (access check)
   - `/api/analysis/*` - analysis tools (access check)

3. **Sharing is stored explicitly**:
  - Primary scope remains on the lecture row (`org_id`, `group_id`)
  - Additional team visibility is tracked in `lecture_team_shares`
  - Lecture-level and workspace-level plans are cached in `lecture_action_plans` and `workspace_action_plans`

---

## 4. UI FOR SHARING/COLLABORATION

### Frontend Pages

**Organizations** (`frontend/src/app/(protected)/organizations/page.tsx`):
- List all workspaces (user's memberships)
- Filter by role (owner, admin, member)
- Create workspace
- Delete workspace (owner only)
- Navigate to "Workspace Details" or "Add/Upload to Team"

**Groups** (`frontend/src/app/(protected)/groups/page.tsx`):
- List teams in selected workspace
- Filter/search teams
- Create team (org admin/owner only)
- Navigate to team details
- No direct add-members UI here

**Workspace View** (`frontend/src/app/(protected)/workspace-view/[id]/page.tsx`):
- Shows all lectures in workspace (filtered by team if selected)
- Team selector dropdown
- Date filter for activity
- View lecture status (uploading, processing, completed, failed)
- Grouped by date bucket (Today, Yesterday, etc.)
- Upload new lecture to workspace/team
- **This is the main hub for uploading content to teams**

**Team Suggestion Modal** (`frontend/src/components/TeamSuggestionModal.tsx`):
- Suggests likely teams when a lecture is being assigned or shared
- Uses organization and group context to help users pick the right destination

**Lecture Details** (`frontend/src/app/(protected)/lecture/[id]/page.tsx`):
- View transcript (with speaker labels, timestamps, utterances)
- Chat interface (RAG-based Q&A)
- Analysis tools: Summary, Notes, Keywords, Questions, Topics, Highlights
- Translation support (Hinglish, Hindi, Gujarati, Marathi, Tamil, Bengali)
- Export to PDF, Markdown, TXT, JSON
- Flashcard viewer (auto-generated from analysis)

### No explicit "Share to Team" UI in current version
- Instead: **Upload → Select org_id + group_id** during upload
- Or: **Manage team memberships** to control access to existing team lectures

---

## 5. BACKEND SERVICES AVAILABLE

### Authentication & Organization
- **Auth Router** (`routers/auth.py`)
  - `POST /api/auth/register`, `LOGIN`, `GET /me`

- **Organizations Router** (`routers/organizations.py`)
  - `POST /api/organizations` - create
  - `GET /api/organizations` - list user's orgs
  - `GET /api/organizations/{id}/members` - list members
  - `GET /api/organizations/{id}/role` - get current user's role
  - `POST /api/organizations/{id}/invite` - invite by email
  - `DELETE /api/organizations/{id}/members/{user_id}` - remove
  - `DELETE /api/organizations/{id}` - delete org (owner only)

### Teams (Groups)
- **Groups Router** (`routers/groups.py`)
  - `POST /api/groups` - create team
  - `GET /api/groups/org/{org_id}` - list teams
  - `GET /api/groups/{id}` - get team details (with access info)
  - `GET /api/groups/{id}/members` - list members
  - `POST /api/groups/{id}/members` - add member
  - `DELETE /api/groups/{id}/members/{user_id}` - remove member

### Lectures
- **Lectures Router** (`routers/lectures.py`)
  - `POST /api/lectures/upload` - upload audio/video/document
  - `GET /api/lectures` - list lectures (with filters: org_id, group_id)
  - `GET /api/lectures/{id}` - get lecture details
  - `DELETE /api/lectures/{id}` - delete lecture

### Content Analysis
- **Analysis Router** (`routers/analysis.py`)
  - `POST /api/analysis/summary` - generate summary (cached)
  - `POST /api/analysis/notes` - structured notes
  - `POST /api/analysis/keywords` - extract keywords
  - `POST /api/analysis/questions` - generate questions
  - `POST /api/analysis/topics` - segment into topics
  - `POST /api/analysis/highlights` - detect key highlights
  - `POST /api/analysis/translate` - translate to target language

- **Chat Router** (`routers/chat.py`, uses RAG)
  - `POST /api/lectures/{id}/chat` - ask question about lecture

### Export
- **Export Router** (`routers/export.py`)
  - `POST /api/export/pdf` - export to PDF
  - `POST /api/export/markdown` - export to Markdown
  - `POST /api/export/txt` - export to TXT
  - `POST /api/export/json` - export to JSON

### Planning Caches
- **Lecture Action Plans**
  - Cached lecture outputs for tasks, timeline, dependencies, and team breakdowns
- **Workspace Action Plans**
  - Cached org/team outputs for shared planning and coordination

### Services (Backend Logic)

**Transcription Service** (`services/transcription_service.py`):
- `transcribe_audio(audio_url) → {"transcript_text", "utterances", "speaker_labels", "detected_language", "duration_seconds", "word_count"}`
- Uses Deepgram API (nova-2)

**Document Extraction Service** (`services/document_extraction_service.py`):
- Extracts text from PDF, DOCX, PPTX

**RAG Service** (`services/rag_service.py`):
- `chunk_transcript(transcript, max_tokens=600, overlap_tokens=100) → chunks[]`
- `generate_embeddings(texts) → embeddings[]` (via Cohere)
- `process_lecture_for_rag(lecture_id, transcript)` - full pipeline
- `retrieve_relevant_chunks(lecture_id, question, top_k=5) → chunks[]`
- `generate_query_embedding(query) → embedding`
- `generate_answer(question, context_chunks) → answer`

**Analysis Service** (`services/analysis_service.py`):
- `generate_summary(transcript, format_type)` - via Groq
- `generate_notes(transcript)` - via Groq
- `extract_keywords(transcript)` - via Groq
- `generate_questions(transcript, format_type)` - via Groq
- `segment_topics(transcript)` - via Groq
- `detect_highlights(transcript)` - via Groq
- `translate_content(content, target_language)` - via Groq

**Organization Service** (`services/organization_service.py`):
- `create_organization(name, owner_id)` → creates org + adds owner
- `get_organizations_for_user(user_id)` → list with user's role
- `get_organization_members(org_id)` → list with group memberships
- `invite_member(org_id, email, role)` - by email (user must exist)
- `remove_member(org_id, user_id)`
- `get_role(org_id, user_id) → role`

**Group Service** (`services/group_service.py`):
- `get_group_by_id(group_id)` → group data
- `get_group_members(group_id)` → members with emails
- `create_group(org_id, name, description, created_by)` → creates group + adds creator as admin
- `get_groups_for_org(org_id)` → all groups
- `get_groups_for_user(org_id, user_id)` → only user's groups
- `add_group_member(group_id, user_id, role)` - org admins auto-elevated
- `remove_group_member(group_id, user_id)`
- `get_group_role(group_id, user_id) → role`

**Supabase Client** (`services/supabase_client.py`):
- Singleton connection to Supabase (Postgres + Vector DB + Storage)

---

## 6. KEY APIS FOR "SUGGEST TEAMS" FEATURE

### To suggest teams to add a lecture to:

**User's teams in organization**:
```
GET /api/groups/org/{org_id}  (org admin/owner see all)
→ Returns: [{ id, org_id, name, description, created_at, ... }]
```

**Team members (to check if user fits)**:
```
GET /api/groups/{group_id}/members
→ Returns: [{ id, user_id, role, joined_at, users: { email } }]
```

**User's role in org** (to restrict suggestions):
```
GET /api/organizations/{org_id}/role
→ Returns: { role: "owner" | "admin" | "member" }
```

**Org members** (to find related people):
```
GET /api/organizations/{org_id}/members
→ Returns: [{ id, org_id, user_id, role, joined_at, users: { email }, groups: [...] }]
```

### Suggestion Strategy Options:

1. **Teams with related members**: Find teams containing colleagues who are in same org
2. **Search by team name/description**: Let user filter teams
3. **Activity-based**: Suggest teams most recently active
4. **Role-based**: Admins see all teams, members only see their teams
5. **Content similarity**: (Future) Analyze lecture content, suggest teams by topic

### Database queries to enable suggestions:

```sql
-- Teams where user is member (can always suggest these)
SELECT g.* FROM groups g
JOIN group_members gm ON g.id = gm.group_id
WHERE gm.user_id = ? AND g.org_id = ?;

-- All teams in org (for org admins)
SELECT * FROM groups WHERE org_id = ?;

-- Team with common members
SELECT g.*, COUNT(gm.user_id) as shared_members FROM groups g
JOIN group_members gm ON g.id = gm.group_id
WHERE g.org_id = ? AND gm.user_id IN (
    SELECT gm2.user_id FROM group_members gm2
    WHERE gm2.group_id IN (
        SELECT g2.id FROM groups g2
        JOIN group_members gm3 ON g2.id = gm3.group_id
        WHERE gm3.user_id = ? AND g2.org_id = ?
    )
)
GROUP BY g.id
ORDER BY shared_members DESC;
```

---

## 7. TECH STACK

### Backend
- **Framework**: FastAPI (Python)
- **Database**: Supabase (PostgreSQL + pgvector)
- **Storage**: Supabase Storage
- **APIs**: 
  - Deepgram (transcription)
  - Cohere (embeddings)
  - Groq (LLM for analysis)

### Frontend
- **Framework**: Next.js (TypeScript/React)
- **API Client**: Axios
- **Auth**: JWT (stored in localStorage)
- **Styling**: CSS (custom classes)

### Infrastructure
- Supabase for: auth, database, storage, vectors
- Environment variables required:
  - `DEEPGRAM_API_KEY`
  - `COHERE_API_KEY`
  - `GROQ_API_KEY`

---

## 8. CURRENT GAPS FOR "SUGGEST TEAMS" FEATURE

1. **No suggestion ranking logic** in backend
   - Could add endpoint: `POST /api/groups/{org_id}/suggestions?lecture_id=X`
   - Returns ranked list based on: user membership, member overlap, recent activity, topic similarity

2. **No explicit sharing/assignment endpoint**
   - Workaround: Upload with `org_id + group_id` or re-upload
   - Could add: `POST /api/lectures/{id}/assign-to-team` to move lecture between teams

3. **UI doesn't show suggested teams during upload**
   - Upload flow selects `org_id` + `group_id` manually
   - Could enhance: Show recommended teams after org selection

4. **No viewing team context when uploading**
   - Could show team descriptions, member count, recent activity
   - Help user choose right team

---

## Files Reference

### Database Schema
- [migration.sql](supabase/migration.sql) - Core schema (users, lectures, lecture_chunks)
- [b2b_migration.sql](supabase/b2b_migration.sql) - Organizations, teams, memberships
- [add_transcript_json.sql](supabase/add_transcript_json.sql) - Structured transcript storage
- [add_analysis_cache.sql](supabase/add_analysis_cache.sql) - Analysis caching

### Backend Services
- [transcription_service.py](backend/app/services/transcription_service.py)
- [rag_service.py](backend/app/services/rag_service.py)
- [organization_service.py](backend/app/services/organization_service.py)
- [group_service.py](backend/app/services/group_service.py)
- [analysis_service.py](backend/app/services/analysis_service.py)

### Backend Routers
- [organizations.py](backend/app/routers/organizations.py)
- [groups.py](backend/app/routers/groups.py)
- [lectures.py](backend/app/routers/lectures.py)
- [chat.py](backend/app/routers/chat.py)
- [analysis.py](backend/app/routers/analysis.py)

### Frontend
- [organizations/page.tsx](frontend/src/app/(protected)/organizations/page.tsx)
- [groups/page.tsx](frontend/src/app/(protected)/groups/page.tsx)
- [workspace-view/[id]/page.tsx](frontend/src/app/(protected)/workspace-view/[id]/page.tsx)
- [lecture/[id]/page.tsx](frontend/src/app/(protected)/lecture/[id]/page.tsx)
- [api.ts](frontend/src/lib/api.ts) - API client definitions

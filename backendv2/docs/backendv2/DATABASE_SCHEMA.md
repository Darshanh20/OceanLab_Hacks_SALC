# Database Schema

This file lists every current table defined by the Supabase migrations in this repository.

## Summary

- Core identity and lecture storage: `users`, `lectures`, `lecture_chunks`
- Workspace and team model: `organizations`, `org_members`, `groups`, `group_members`
- AI output caches: `lecture_analysis`, `lecture_action_plans`, `workspace_action_plans`
- Sharing: `lecture_team_shares`

## Tables

### `users`
Purpose: application users and login identity.

| Column | Type | Constraints |
|---|---|---|
| `id` | `UUID` | Primary key, default `gen_random_uuid()` |
| `email` | `TEXT` | Unique, not null |
| `password_hash` | `TEXT` | Not null |
| `created_at` | `TIMESTAMPTZ` | Default `NOW()` |

### `lectures`
Purpose: uploaded documents, audio, and meeting transcripts.

| Column | Type | Constraints |
|---|---|---|
| `id` | `UUID` | Primary key, default `gen_random_uuid()` |
| `user_id` | `UUID` | Not null, foreign key to `users(id)` on delete cascade |
| `title` | `TEXT` | Not null |
| `audio_url` | `TEXT` | Nullable |
| `transcript_text` | `TEXT` | Nullable |
| `summary_text` | `TEXT` | Nullable |
| `status` | `TEXT` | Default `uploading`, must be one of `uploading`, `transcribing`, `summarizing`, `processing_rag`, `completed`, `failed` |
| `created_at` | `TIMESTAMPTZ` | Default `NOW()` |
| `transcript_json` | `TEXT` | Added later for structured transcript data |
| `org_id` | `UUID` | Nullable, foreign key to `organizations(id)` on delete cascade |
| `group_id` | `UUID` | Nullable, foreign key to `groups(id)` on delete cascade |

### `lecture_chunks`
Purpose: RAG chunks and embeddings for similarity search.

| Column | Type | Constraints |
|---|---|---|
| `id` | `UUID` | Primary key, default `gen_random_uuid()` |
| `lecture_id` | `UUID` | Not null, foreign key to `lectures(id)` on delete cascade |
| `chunk_text` | `TEXT` | Not null |
| `embedding` | `vector(1024)` | Nullable, pgvector embedding |

### `organizations`
Purpose: workspaces that contain users and teams.

| Column | Type | Constraints |
|---|---|---|
| `id` | `UUID` | Primary key, default `gen_random_uuid()` |
| `name` | `TEXT` | Not null |
| `subscription_tier` | `TEXT` | Default `free`, must be one of `free`, `pro`, `enterprise` |
| `subscription_status` | `TEXT` | Default `active`, must be one of `active`, `inactive`, `cancelled` |
| `owner_id` | `UUID` | Not null, foreign key to `users(id)` on delete cascade |
| `created_at` | `TIMESTAMPTZ` | Default `NOW()` |

### `org_members`
Purpose: membership and roles within a workspace.

| Column | Type | Constraints |
|---|---|---|
| `id` | `UUID` | Primary key, default `gen_random_uuid()` |
| `org_id` | `UUID` | Not null, foreign key to `organizations(id)` on delete cascade |
| `user_id` | `UUID` | Not null, foreign key to `users(id)` on delete cascade |
| `role` | `TEXT` | Default `member`, must be one of `owner`, `admin`, `member` |
| `joined_at` | `TIMESTAMPTZ` | Default `NOW()` |

Unique constraint: `(org_id, user_id)`.

### `groups`
Purpose: teams within a workspace.

| Column | Type | Constraints |
|---|---|---|
| `id` | `UUID` | Primary key, default `gen_random_uuid()` |
| `org_id` | `UUID` | Not null, foreign key to `organizations(id)` on delete cascade |
| `name` | `TEXT` | Not null |
| `description` | `TEXT` | Nullable |
| `created_by` | `UUID` | Not null in the migration, foreign key to `users(id)` on delete set null |
| `created_at` | `TIMESTAMPTZ` | Default `NOW()` |

### `group_members`
Purpose: membership and roles within a team.

| Column | Type | Constraints |
|---|---|---|
| `id` | `UUID` | Primary key, default `gen_random_uuid()` |
| `group_id` | `UUID` | Not null, foreign key to `groups(id)` on delete cascade |
| `user_id` | `UUID` | Not null, foreign key to `users(id)` on delete cascade |
| `role` | `TEXT` | Default `member`, must be one of `admin`, `member` |
| `joined_at` | `TIMESTAMPTZ` | Default `NOW()` |

Unique constraint: `(group_id, user_id)`.

### `lecture_analysis`
Purpose: cached AI analysis results for a lecture.

| Column | Type | Constraints |
|---|---|---|
| `id` | `UUID` | Primary key, default `gen_random_uuid()` |
| `lecture_id` | `UUID` | Not null, foreign key to `lectures(id)` on delete cascade |
| `analysis_type` | `TEXT` | Not null |
| `content` | `TEXT` | Not null |
| `created_at` | `TIMESTAMPTZ` | Default `NOW()` |

Unique constraint: `(lecture_id, analysis_type)`.

### `lecture_team_shares`
Purpose: additional team sharing for a lecture.

| Column | Type | Constraints |
|---|---|---|
| `id` | `UUID` | Primary key, default `gen_random_uuid()` |
| `lecture_id` | `UUID` | Not null, foreign key to `lectures(id)` on delete cascade |
| `group_id` | `UUID` | Not null, foreign key to `groups(id)` on delete cascade |
| `shared_at` | `TIMESTAMPTZ` | Default `NOW()` |

Unique constraint: `(lecture_id, group_id)`.

### `lecture_action_plans`
Purpose: cached lecture-level action plans and task breakdowns.

| Column | Type | Constraints |
|---|---|---|
| `id` | `UUID` | Primary key, default `gen_random_uuid()` |
| `lecture_id` | `UUID` | Not null, foreign key to `lectures(id)` on delete cascade |
| `markdown_content` | `TEXT` | Not null |
| `content_json` | `JSONB` | Not null |
| `tasks_json` | `JSONB` | Not null, default `[]` |
| `timeline_json` | `JSONB` | Not null, default `[]` |
| `dependencies_json` | `JSONB` | Not null, default `[]` |
| `team_breakdown_json` | `JSONB` | Not null, default `{}` |
| `share_team_ids_json` | `JSONB` | Not null, default `[]` |
| `is_shared` | `BOOLEAN` | Not null, default `false` |
| `created_at` | `TIMESTAMPTZ` | Default `NOW()` |
| `updated_at` | `TIMESTAMPTZ` | Default `NOW()` |

Unique constraint: `(lecture_id)`.

### `workspace_action_plans`
Purpose: cached organization- and team-level action plans.

| Column | Type | Constraints |
|---|---|---|
| `id` | `UUID` | Primary key, default `gen_random_uuid()` |
| `org_id` | `UUID` | Not null, foreign key to `organizations(id)` on delete cascade |
| `group_id` | `UUID` | Nullable, foreign key to `groups(id)` on delete cascade |
| `markdown_content` | `TEXT` | Not null |
| `content_json` | `JSONB` | Not null |
| `tasks_json` | `JSONB` | Not null, default `[]` |
| `timeline_json` | `JSONB` | Not null, default `[]` |
| `dependencies_json` | `JSONB` | Not null, default `[]` |
| `team_breakdown_json` | `JSONB` | Not null, default `{}` |
| `risks_json` | `JSONB` | Not null, default `[]` |
| `created_at` | `TIMESTAMPTZ` | Default `NOW()` |
| `updated_at` | `TIMESTAMPTZ` | Default `NOW()` |

Unique index: `org_id` plus normalized `group_id` scope.

## Indexes and Functions

### Indexes
- `idx_lectures_user_id` on `lectures(user_id)`
- `idx_lecture_chunks_lecture_id` on `lecture_chunks(lecture_id)`
- `idx_lecture_chunks_embedding` on `lecture_chunks(embedding)` using `ivfflat` and `vector_cosine_ops` in the initial migration
- `idx_org_members_org_id` on `org_members(org_id)`
- `idx_org_members_user_id` on `org_members(user_id)`
- `idx_groups_org_id` on `groups(org_id)`
- `idx_group_members_group_id` on `group_members(group_id)`
- `idx_lectures_org_id` on `lectures(org_id)`
- `idx_lectures_group_id` on `lectures(group_id)`
- `idx_lecture_analysis_lecture_id` on `lecture_analysis(lecture_id)`
- `idx_lecture_analysis_type` on `lecture_analysis(lecture_id, analysis_type)`
- `idx_lecture_team_shares_lecture_id` on `lecture_team_shares(lecture_id)`
- `idx_lecture_team_shares_group_id` on `lecture_team_shares(group_id)`
- `idx_lecture_action_plans_lecture_id` on `lecture_action_plans(lecture_id)`
- `idx_workspace_action_plans_org_id` on `workspace_action_plans(org_id)`
- `idx_workspace_action_plans_group_id` on `workspace_action_plans(group_id)`

### RPC / SQL Function
- `match_lecture_chunks(query_embedding vector(1024), match_lecture_id uuid, match_count int)`
  - Returns the most similar chunks for a lecture using cosine distance.

## Row Level Security

Every table in the migrations enables RLS and uses a permissive `Service role access` policy for backend access through Supabase service credentials.

## Notes

- `lecture_chunks.embedding` is currently `vector(1024)`.
- `lectures.transcript_json` stores structured transcript payloads from transcription or extraction.
- `lecture_team_shares` allows one lecture to be visible to more than one team.
- `lecture_action_plans` and `workspace_action_plans` are cache tables for AI-generated planning output.

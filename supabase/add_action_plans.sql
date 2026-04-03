-- Action planning cache tables

CREATE TABLE IF NOT EXISTS lecture_action_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lecture_id UUID NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
    markdown_content TEXT NOT NULL,
    content_json JSONB NOT NULL,
    tasks_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    timeline_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    dependencies_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    team_breakdown_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    share_team_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_shared BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(lecture_id)
);

CREATE TABLE IF NOT EXISTS workspace_action_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    markdown_content TEXT NOT NULL,
    content_json JSONB NOT NULL,
    tasks_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    timeline_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    dependencies_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    team_breakdown_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    risks_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Make migration re-runnable on environments where table existed without newer columns.
ALTER TABLE lecture_action_plans ADD COLUMN IF NOT EXISTS share_team_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE lecture_action_plans ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT false;

-- Some environments may have a partially created workspace_action_plans table.
-- Ensure scope columns exist before creating indexes on them.
ALTER TABLE workspace_action_plans ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE workspace_action_plans ADD COLUMN IF NOT EXISTS group_id UUID;

-- Add foreign keys safely if not present.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'workspace_action_plans_org_id_fkey'
    ) THEN
        ALTER TABLE workspace_action_plans
        ADD CONSTRAINT workspace_action_plans_org_id_fkey
        FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'workspace_action_plans_group_id_fkey'
    ) THEN
        ALTER TABLE workspace_action_plans
        ADD CONSTRAINT workspace_action_plans_group_id_fkey
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_action_plans_scope
ON workspace_action_plans(org_id, (COALESCE(group_id, '00000000-0000-0000-0000-000000000000'::uuid)));

CREATE INDEX IF NOT EXISTS idx_lecture_action_plans_lecture_id ON lecture_action_plans(lecture_id);
CREATE INDEX IF NOT EXISTS idx_workspace_action_plans_org_id ON workspace_action_plans(org_id);
CREATE INDEX IF NOT EXISTS idx_workspace_action_plans_group_id ON workspace_action_plans(group_id);

ALTER TABLE lecture_action_plans ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'lecture_action_plans'
          AND policyname = 'Service role access'
    ) THEN
        CREATE POLICY "Service role access" ON lecture_action_plans FOR ALL USING (true);
    END IF;
END $$;

ALTER TABLE workspace_action_plans ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'workspace_action_plans'
          AND policyname = 'Service role access'
    ) THEN
        CREATE POLICY "Service role access" ON workspace_action_plans FOR ALL USING (true);
    END IF;
END $$;

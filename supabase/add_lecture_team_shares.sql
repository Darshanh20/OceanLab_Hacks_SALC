-- Add lecture sharing across multiple teams

CREATE TABLE IF NOT EXISTS lecture_team_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lecture_id UUID NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    shared_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(lecture_id, group_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_lecture_team_shares_lecture_id ON lecture_team_shares(lecture_id);
CREATE INDEX IF NOT EXISTS idx_lecture_team_shares_group_id ON lecture_team_shares(group_id);

-- RLS
ALTER TABLE lecture_team_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role access" ON lecture_team_shares FOR ALL USING (true);

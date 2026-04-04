-- Add lecture_analysis table for caching analysis results
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS lecture_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lecture_id UUID NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
    analysis_type TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(lecture_id, analysis_type)
);

CREATE INDEX IF NOT EXISTS idx_lecture_analysis_lecture_id ON lecture_analysis(lecture_id);
CREATE INDEX IF NOT EXISTS idx_lecture_analysis_type ON lecture_analysis(lecture_id, analysis_type);

-- RLS
ALTER TABLE lecture_analysis ENABLE ROW LEVEL SECURITY;

-- Grants (required before policies can be exercised by API roles)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE lecture_analysis TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE lecture_analysis TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE lecture_analysis TO service_role;

-- Recreate policies idempotently to avoid stale/partial policy state
DROP POLICY IF EXISTS "Service role access" ON lecture_analysis;
DROP POLICY IF EXISTS "Authenticated access" ON lecture_analysis;
DROP POLICY IF EXISTS "Anon access" ON lecture_analysis;

CREATE POLICY "Service role access"
ON lecture_analysis
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated access"
ON lecture_analysis
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Anon access"
ON lecture_analysis
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

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
CREATE POLICY "Service role access" ON lecture_analysis FOR ALL USING (true);

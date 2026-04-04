-- MIGRATION: Add missing columns to lectures table
-- Phase: Backend V2 Production Hardening
-- Date: April 4, 2026

-- Add error_message column for tracking processing failures
ALTER TABLE lectures ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Add topics column for storing extracted topics from transcription
ALTER TABLE lectures ADD COLUMN IF NOT EXISTS topics JSONB;

-- Create indexes for better query performance on status column
CREATE INDEX IF NOT EXISTS idx_lectures_status ON lectures(status);
CREATE INDEX IF NOT EXISTS idx_lectures_user_status ON lectures(user_id, status);

-- Add comment for documentation
COMMENT ON COLUMN lectures.error_message IS 'Error message from failed processing stages (transcription, RAG, etc.)';
COMMENT ON COLUMN lectures.topics IS 'JSON array of topics extracted from transcript by transcription service';

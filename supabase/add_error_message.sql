-- Add error_message column and expand status enum for link processing
ALTER TABLE lectures ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Update the status CHECK constraint to include 'uploaded' and 'recording' statuses
ALTER TABLE lectures DROP CONSTRAINT IF EXISTS lectures_status_check;
ALTER TABLE lectures ADD CONSTRAINT lectures_status_check 
    CHECK (status IN ('uploading', 'uploaded', 'transcribing', 'summarizing', 'processing_rag', 'completed', 'failed', 'recording'));

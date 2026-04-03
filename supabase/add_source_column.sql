-- Add source column to track where lectures come from (upload, youtube, google_drive, etc)
ALTER TABLE lectures ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'upload';

-- Update status check to include 'uploaded' state
ALTER TABLE lectures DROP CONSTRAINT IF EXISTS lectures_status_check;
ALTER TABLE lectures ADD CONSTRAINT lectures_status_check 
    CHECK (status IN ('uploading', 'uploaded', 'transcribing', 'summarizing', 'processing_rag', 'completed', 'failed'));

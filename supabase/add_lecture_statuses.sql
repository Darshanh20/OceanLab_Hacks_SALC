-- Extend allowed lecture pipeline statuses for async link processing.
ALTER TABLE lectures DROP CONSTRAINT IF EXISTS lectures_status_check;

ALTER TABLE lectures
ADD CONSTRAINT lectures_status_check CHECK (
    status IN (
        'queued',
        'downloading',
        'converting',
        'uploading',
        'transcribing',
        'processing_rag',
        'completed',
        'failed',
        'cancelled'
    )
);

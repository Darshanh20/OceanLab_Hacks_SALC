-- Update vector dimension for Cohere embeddings (768 → 1024)
-- Run this in Supabase SQL Editor

-- Step 1: Drop old index and function
DROP INDEX IF EXISTS idx_lecture_chunks_embedding;
DROP FUNCTION IF EXISTS match_lecture_chunks;

-- Step 2: Delete old chunks (they have wrong dimension anyway)
DELETE FROM lecture_chunks;

-- Step 3: Drop and re-add embedding column with new dimension
ALTER TABLE lecture_chunks DROP COLUMN IF EXISTS embedding;
ALTER TABLE lecture_chunks ADD COLUMN embedding vector(1024);

-- Step 4: Recreate RPC function
CREATE OR REPLACE FUNCTION match_lecture_chunks(
    query_embedding vector(1024),
    match_lecture_id UUID,
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    chunk_text TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        lc.id,
        lc.chunk_text,
        1 - (lc.embedding <=> query_embedding) AS similarity
    FROM lecture_chunks lc
    WHERE lc.lecture_id = match_lecture_id
    AND lc.embedding IS NOT NULL
    ORDER BY lc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- NOTE: Skipping vector index for now (Supabase free tier has limited memory).
-- The index is optional — it only speeds up search for large datasets.
-- It will work fine without it for typical usage.

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lectures table
CREATE TABLE IF NOT EXISTS lectures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    audio_url TEXT,
    transcript_text TEXT,
    summary_text TEXT,
    status TEXT DEFAULT 'uploading' CHECK (status IN ('uploading', 'transcribing', 'summarizing', 'processing_rag', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lecture chunks table for RAG
CREATE TABLE IF NOT EXISTS lecture_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lecture_id UUID NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
    chunk_text TEXT NOT NULL,
    embedding vector(768)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lectures_user_id ON lectures(user_id);
CREATE INDEX IF NOT EXISTS idx_lecture_chunks_lecture_id ON lecture_chunks(lecture_id);

-- Vector similarity search index (IVFFlat for performance)
CREATE INDEX IF NOT EXISTS idx_lecture_chunks_embedding ON lecture_chunks
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- RPC function for similarity search
CREATE OR REPLACE FUNCTION match_lecture_chunks(
    query_embedding vector(768),
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
    ORDER BY lc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE lecture_chunks ENABLE ROW LEVEL SECURITY;

-- Policies (allow service role full access, used by backend)
CREATE POLICY "Service role access" ON users FOR ALL USING (true);
CREATE POLICY "Service role access" ON lectures FOR ALL USING (true);
CREATE POLICY "Service role access" ON lecture_chunks FOR ALL USING (true);

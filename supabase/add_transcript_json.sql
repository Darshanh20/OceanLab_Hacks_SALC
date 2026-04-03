-- Add transcript_json column to store structured transcript data
-- (speaker labels, timestamps, utterances from Deepgram)
-- Run this in Supabase SQL Editor

ALTER TABLE lectures ADD COLUMN IF NOT EXISTS transcript_json TEXT;

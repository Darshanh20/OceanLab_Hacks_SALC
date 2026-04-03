-- Make user_id nullable to support anonymous link uploads
ALTER TABLE lectures ALTER COLUMN user_id DROP NOT NULL;

-- Migration: Add short_id column for URL shortening
-- Created: 2025-10-06

-- Add short_id column without UNIQUE constraint first
ALTER TABLE images ADD COLUMN short_id TEXT;

-- Create unique index (allows NULL values)
CREATE UNIQUE INDEX idx_images_short_id ON images(short_id) WHERE short_id IS NOT NULL;

-- Note: Existing images will have NULL short_id initially.
-- Run SQL to populate: UPDATE images SET short_id = '<generated>' WHERE id = '<uuid>';

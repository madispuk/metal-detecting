-- Migration to add name and description columns to photos table
-- Run this migration if you have an existing photos table

-- Add name column
ALTER TABLE photos ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- Add description column  
ALTER TABLE photos ADD COLUMN IF NOT EXISTS description TEXT;

-- Create index on name for faster searching
CREATE INDEX IF NOT EXISTS idx_photos_name ON photos(name);

-- Create index on description for faster searching (using GIN index for text search)
CREATE INDEX IF NOT EXISTS idx_photos_description ON photos USING GIN(to_tsvector('english', description));

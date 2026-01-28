-- Migration script to add thumbnail_data column to existing photos table
-- Run this in your Supabase SQL editor if the column doesn't exist yet

-- Check if thumbnail_data column exists, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'photos' 
        AND column_name = 'thumbnail_data'
    ) THEN
        ALTER TABLE photos ADD COLUMN thumbnail_data TEXT;
        RAISE NOTICE 'Added thumbnail_data column to photos table';
    ELSE
        RAISE NOTICE 'thumbnail_data column already exists';
    END IF;
END $$;

-- Optional: Create an index on thumbnail_data for better performance
-- (Only if you plan to query by thumbnail_data)
-- CREATE INDEX IF NOT EXISTS idx_photos_thumbnail ON photos(thumbnail_data);

-- Optional: Update existing photos to generate thumbnails
-- This would require running the thumbnail generation for existing photos
-- You might want to do this programmatically in your app instead

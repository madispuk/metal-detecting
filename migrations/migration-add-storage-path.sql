-- Add storage_path field to photos table for storing original images in Supabase Storage
ALTER TABLE photos ADD COLUMN IF NOT EXISTS storage_path VARCHAR(500);

-- Create an index on storage_path for faster queries
CREATE INDEX IF NOT EXISTS idx_photos_storage_path ON photos(storage_path);

-- Add comment to explain the field
COMMENT ON COLUMN photos.storage_path IS 'Path to the original image file in Supabase Storage bucket';

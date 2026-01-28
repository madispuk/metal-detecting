-- Migration to add admin permissions and user tracking to photos table

-- Add user_id column to track who uploaded each photo
ALTER TABLE photos ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Add admin column to user metadata (this will be set via Supabase dashboard or admin functions)
-- Note: This is handled in the application code via user_metadata.admin

-- Update RLS policies to be more restrictive
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON photos;

-- Policy for reading photos - all authenticated users can read
CREATE POLICY "Allow authenticated users to read photos" ON photos
  FOR SELECT USING (auth.role() = 'authenticated');

-- Policy for inserting photos - only admin users can insert
CREATE POLICY "Allow admin users to insert photos" ON photos
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND 
    (auth.jwt() -> 'app_metadata' ->> 'admin')::boolean = true
  );

-- Policy for updating photos - only admin users can update
CREATE POLICY "Allow admin users to update photos" ON photos
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND 
    (auth.jwt() -> 'app_metadata' ->> 'admin')::boolean = true
  );

-- Policy for deleting photos - only admin users can delete
CREATE POLICY "Allow admin users to delete photos" ON photos
  FOR DELETE USING (
    auth.role() = 'authenticated' AND 
    (auth.jwt() -> 'app_metadata' ->> 'admin')::boolean = true
  );

-- Create index on user_id for better performance
CREATE INDEX IF NOT EXISTS idx_photos_user_id ON photos(user_id);

-- Update existing photos to have a default user_id (you may want to set this to a specific admin user)
-- UPDATE photos SET user_id = (SELECT id FROM auth.users WHERE email = 'your-admin-email@example.com' LIMIT 1) WHERE user_id IS NULL;

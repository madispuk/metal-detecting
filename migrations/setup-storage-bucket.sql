-- Setup script for Supabase Storage bucket and policies
-- Run this in your Supabase SQL editor after creating the storage bucket

-- Create storage bucket (run this in Supabase dashboard first)
-- Bucket name: original-images
-- Public: true

-- Storage policies for the original-images bucket
CREATE POLICY "Allow authenticated users to upload files" ON storage.objects
FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND bucket_id = 'original-images');

CREATE POLICY "Allow authenticated users to view files" ON storage.objects
FOR SELECT USING (auth.role() = 'authenticated' AND bucket_id = 'original-images');

CREATE POLICY "Allow authenticated users to delete their own files" ON storage.objects
FOR DELETE USING (auth.role() = 'authenticated' AND bucket_id = 'original-images');

-- Optional: Allow public access to view files (if you want direct URL access)
-- CREATE POLICY "Allow public access to view files" ON storage.objects
-- FOR SELECT USING (bucket_id = 'original-images');

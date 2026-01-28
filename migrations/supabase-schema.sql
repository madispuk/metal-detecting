-- Create photos table for storing captured photos and locations
CREATE TABLE IF NOT EXISTS photos (
  id BIGSERIAL PRIMARY KEY,
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  image_data TEXT NOT NULL, -- Base64 encoded image data
  thumbnail_data TEXT, -- Base64 encoded thumbnail data
  timestamp TIMESTAMPTZ NOT NULL,
  filename VARCHAR(255),
  type VARCHAR(100), -- Random string type field
  name VARCHAR(255), -- Photo name/title
  description TEXT, -- Photo description
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create an index on coordinates for faster queries
CREATE INDEX IF NOT EXISTS idx_photos_coordinates ON photos(lat, lng);

-- Create an index on timestamp for faster sorting
CREATE INDEX IF NOT EXISTS idx_photos_timestamp ON photos(timestamp);

-- Create an index on type for faster filtering
CREATE INDEX IF NOT EXISTS idx_photos_type ON photos(type);

-- Enable Row Level Security (RLS)
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations for authenticated users
-- You can modify this based on your authentication requirements
CREATE POLICY "Allow all operations for authenticated users" ON photos
  FOR ALL USING (auth.role() = 'authenticated');

-- Anonymous access policy removed for security
-- Only authenticated users can access the photos table

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a trigger to automatically update the updated_at column
CREATE TRIGGER update_photos_updated_at 
  BEFORE UPDATE ON photos 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

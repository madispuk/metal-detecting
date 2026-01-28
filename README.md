# Metal Detecting App

A React-based web application for metal detecting enthusiasts to capture and store photos with precise GPS coordinates using satellite imagery.

## Features

- **List View** - Browse all finds in a searchable, sortable list (default view)
- **Satellite Imagery** - High-resolution Esri satellite maps
- **GPS Location** - Automatic location detection and manual coordinate capture
- **Photo Capture** - Take photos with precise GPS coordinates
- **Photo Categorization** - Categorize finds by type (coins, jewelry, relics, etc.)
- **Database Storage** - Supabase integration for persistent data storage
- **Authentication** - Secure login with user management
- **Mobile Friendly** - Optimized for mobile metal detecting adventures
- **Interactive Map** - Click anywhere to capture photos at specific locations

## Tech Stack

- **Frontend**: React 19 + Vite
- **Maps**: Leaflet + React-Leaflet
- **Database**: Supabase
- **Storage**: Supabase Storage (for original images)
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account

### Installation

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd metal-detecting
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Fill in your Supabase credentials in the `.env` file:

   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

## Supabase Setup

### Database Schema

Create the photos table in your Supabase SQL editor:

```sql
CREATE TABLE photos (
  id BIGSERIAL PRIMARY KEY,
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  image_data TEXT,
  thumbnail_data TEXT,
  storage_path TEXT,
  filename TEXT,
  type TEXT,
  name TEXT,
  description TEXT,
  user_id UUID REFERENCES auth.users(id),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated access
CREATE POLICY "Allow authenticated access" ON photos
  FOR ALL USING (auth.role() = 'authenticated');
```

### Storage Bucket

Create a storage bucket named `original-images` in your Supabase dashboard for storing full-resolution photos.

### Environment Variables

Get your Supabase credentials from your project dashboard:

- **Project URL**: Found in Settings > API
- **Anon Key**: Found in Settings > API (anon/public key)

> **Note**: The `.env` file is automatically ignored by git to prevent committing sensitive credentials.

## Deployment with Vercel

### Option 1: Vercel CLI

```bash
npm i -g vercel
vercel login
vercel
```

### Option 2: GitHub Integration

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "New Project" and import your repository
4. Add environment variables in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

## Usage

1. **Log in** with your credentials
2. **Browse finds** in the List view (default landing page)
3. **Switch to Map view** to see locations on satellite imagery
4. **Click on the map** to capture a new photo at that location
5. **Categorize finds** by type when uploading
6. **Jump to map** from any list item to see its exact location

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Project Structure

```
src/
├── components/
│   ├── AuthGuard.jsx       # Authentication wrapper
│   ├── Header.jsx          # Navigation header
│   ├── ListView.jsx        # List view component
│   ├── LoadingSpinner.jsx  # Loading indicator
│   └── LoginForm.jsx       # Login form
├── contexts/
│   ├── AuthContext.jsx     # Authentication context
│   └── PhotosContext.jsx   # Photos state context
├── hooks/
│   └── useAuth.js          # Authentication hook
├── lib/
│   └── utils.js            # Utility functions
├── App.jsx                 # Root component
├── MapComponent.jsx        # Map view component
├── PhotoModal.jsx          # Photo detail modal
├── photoService.js         # Supabase photo operations
├── supabase.js             # Supabase client configuration
└── ToastNotification.jsx   # Toast notifications
```

## License

This project is open source and available under the [MIT License](LICENSE).

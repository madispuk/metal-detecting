# Metal Detecting App 🗺️

A React-based web application for metal detecting enthusiasts to capture and store photos with precise GPS coordinates using satellite imagery.

## Features

- 🛰️ **Satellite Imagery** - High-resolution Esri satellite maps
- 📍 **GPS Location** - Automatic location detection and manual coordinate capture
- 📸 **Photo Capture** - Take photos with precise GPS coordinates
- 💾 **Database Storage** - Supabase integration for persistent data storage
- 📱 **Mobile Friendly** - Optimized for mobile metal detecting adventures
- 🗺️ **Interactive Map** - Click anywhere to capture photos at specific locations

## Tech Stack

- **Frontend**: React 19 + Vite
- **Maps**: Leaflet + React-Leaflet
- **Database**: Supabase
- **Deployment**: Vercel
- **Styling**: CSS3

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
   # Copy the example environment file
   cp .env.example .env

   # Edit .env with your actual Supabase credentials
   nano .env  # or use your preferred editor
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

The app uses a simple photos table. Run the SQL from `supabase-schema.sql` in your Supabase SQL editor:

```sql
-- Create photos table
CREATE TABLE photos (
  id BIGSERIAL PRIMARY KEY,
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  image_data TEXT NOT NULL,
  filename TEXT,
  type TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Create policy for public access (adjust as needed)
CREATE POLICY "Allow public access" ON photos FOR ALL USING (true);
```

### Environment Variables

Get your Supabase credentials from your project dashboard:

- **Project URL**: Found in Settings > API
- **Anon Key**: Found in Settings > API (anon/public key)

> **Note**: The `.env` file is automatically ignored by git to prevent committing sensitive credentials. Always use `.env.example` as a template for new setups.

## Deployment with Vercel

### Option 1: Vercel CLI (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel
```

### Option 2: GitHub Integration

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "New Project" and import your repository
4. Add environment variables in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

### Vercel Configuration

The app includes a `vercel.json` file with optimized settings for Vite + React deployment.

## Usage

1. **Allow location access** when prompted
2. **Navigate to your metal detecting location**
3. **Click on the map** where you want to capture a photo
4. **Take a photo** using your device's camera
5. **View captured photos** by hovering over blue markers
6. **Click markers** to see full photo details and delete if needed

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Project Structure

```
src/
├── MapComponent.jsx    # Main map component
├── photoService.js     # Supabase photo operations
├── supabase.js         # Supabase client configuration
└── App.jsx            # Root component
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).

## Support

For issues and questions:

- Check the [Issues](https://github.com/your-username/metal-detecting/issues) page
- Review the [Supabase documentation](https://supabase.com/docs)
- Check [Vercel documentation](https://vercel.com/docs) for deployment help

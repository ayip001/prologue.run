# Prologue.run

Street View for marathon runners. Scout the course before race day.

## What is this?

Prologue.run is a web-based 360° course viewer that lets you preview marathon routes from a runner's perspective. Think Google Street View, but designed specifically for race day prep.

I built this because I kept wishing I could see courses before traveling to run them. One day I looked at the dusty 360° camera on my shelf and the idea clicked.

## Features

- **360° Panoramic Viewer** - Custom WebGL viewer that projects equirectangular images onto a sphere. I had to build this from scratch because existing libraries didn't fit my needs.
- **Elevation Profile** - Synced with your position on the course. Know exactly where the hills hit.
- **Points of Interest** - Water stations, checkpoints, and aid stations marked along the route.
- **Progressive Image Loading** - Starts with thumbnails, upgrades to full resolution as you navigate.
- **URL State** - Camera position is encoded in the URL. Share a specific view with your running group.
- **Privacy Protected** - AI-driven automatic blurring of faces and license plates.

## Tech Stack

**Frontend**
- Next.js 14 (App Router)
- TypeScript
- Three.js / React Three Fiber
- Tailwind CSS
- next-intl for i18n (English + Traditional Chinese)

**Backend & Storage**
- PostgreSQL with PostGIS
- Cloudflare R2 for image storage
- Upstash for rate limiting and caching
- Deployed on Vercel

**Image Processing**
- Python CLI tool (`race-processor/`)
- YOLOv8/v12 models for face and license plate detection
- 6-stage pipeline: Intake → Blur → Watermark → Resize → Export → Upload

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (Neon.tech works well)
- Cloudflare R2 bucket
- Python 3.11+ (for image processing)

### Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/prologue.run.git
cd prologue.run

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
```

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...

# Cloudflare R2
R2_ENDPOINT=https://...r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=race-images

# CDN
CDN_BASE_URL=https://images.prologue.run
```

### Development

```bash
npm run dev          # Start dev server at http://localhost:3000
npm run lint         # Run ESLint
npm run build        # Production build
```

### Database

```bash
npm run db:migrate   # Apply schema
npm run db:seed      # Seed test data
```

## Image Processing

The `race-processor/` directory contains a Python CLI for processing 360° images. It handles:

1. **Intake** - Import images, extract EXIF, sort by timestamp
2. **Blur** - AI-powered privacy protection (faces, plates)
3. **Watermark** - Copyright overlay
4. **Resize** - Generate quality tiers (512px, 2048px, 4096px)
5. **Export** - Encode to WebP
6. **Upload** - Push to R2, generate DB records

```bash
cd race-processor
pip install -e .

# Process a race
race-processor process -i ./images -r my-race-2026

# See all options
race-processor --help
```

Full documentation: [`race-processor/USAGE.md`](race-processor/USAGE.md)

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/races/          # REST API
│   └── [locale]/           # i18n routes
│       └── race/[slug]/    # Race viewer page
├── components/
│   ├── viewer/             # 360° viewer components
│   ├── landing/            # Homepage components
│   └── ui/                 # Reusable UI
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities
└── types/                  # TypeScript interfaces

race-processor/             # Python CLI
messages/                   # i18n translations
db/                         # Schema and migrations
```

## FAQ

**Why is the viewer janky compared to Google Maps?**

Google has thousands of engineers. Prologue has one. I'm constantly improving it.

**Why is the race library so small?**

I'm building this one race at a time, starting with my own running schedule. The library grows as I run more races.

**Can I contribute a race route?**

Yes! If you have a 360° camera and can record a full course, reach out. I'll guide you through the process.

**Is it free?**

Yes. If it helps you get a PB, that's payment enough.

## License

This project is proprietary. All rights reserved.

## Contact

- Email: [contact@prologue.run](mailto:contact@prologue.run)
- Issues: [GitHub Issues](https://github.com/yourusername/prologue.run/issues)

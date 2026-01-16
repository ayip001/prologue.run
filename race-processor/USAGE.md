# Race Processor Usage Manual

A CLI tool for processing 360° equirectangular images into web-optimized, privacy-protected panoramic images for the Prologue.run race viewer.

## Prerequisites

- Equirectangular images exported from Insta360 Studio (with horizon lock enabled)
- Python 3.11+
- NVIDIA GPU recommended for blur detection

## Installation

```bash
cd race-processor
pip install -e .
```

### Required Models

Download the following YOLO models and place them in `race-processor/models/`:

| Model | Purpose | Download |
|-------|---------|----------|
| `yolov8n.pt` | General detection | [Ultralytics](https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8n.pt) |
| `yolov8n-pose.pt` | Body pose (head estimation) | [Ultralytics](https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8n-pose.pt) |
| `yolov8n-plate.pt` | License plate detection | [yasirfaizahmed/license-plate-object-detection](https://huggingface.co/yasirfaizahmed/license-plate-object-detection) |
| `yolov12m-face.pt` | Face detection | [deepghs/yolov12_face_detection](https://huggingface.co/deepghs/yolov12_face_detection) |

```bash
mkdir -p race-processor/models
# Download models manually and place in models/
```

## Quick Start

```bash
# Process a folder of equirectangular images
race-processor process -i ./exported-images -r my-race-2026

# With debug output to inspect each step
race-processor process -i ./exported-images -r my-race-2026 --debug

# Process only the blur step
race-processor process -i ./exported-images -r my-race-2026 --step 2

# Direct mode: test blur on arbitrary JPEG files
race-processor process --step 2 --src ./my-images --dst ./output-test
```

## Pipeline Steps

The processor runs a 6-stage pipeline:

| Step | Name      | Description                                        |
|------|-----------|----------------------------------------------------|
| 1    | Intake    | Import images, extract EXIF, sort by timestamp, rename sequentially |
| 2    | Blur      | Apply privacy blurring (faces, license plates)     |
| 3    | Watermark | Add copyright text overlay                         |
| 4    | Resize    | Generate quality tiers (512px, 2048px, 4096px)     |
| 5    | Export    | Encode to WebP format                              |
| 6    | Upload    | Privacy check, upload to R2, generate DB records   |

## Preview Commands

Test individual steps on single images without running the full pipeline:

### `preview-blur` - Test Detection

```bash
# Show detection boxes with sources color-coded
race-processor preview-blur image.jpg --conf 0.05 --show-sources

# Apply actual blur effect
race-processor preview-blur image.jpg --blur --conf 0.1
```

Options:
- `--conf FLOAT` - Confidence threshold (default: 0.12, lower = more detections)
- `--show-sources` - Color-code boxes by detection source
- `--blur` - Apply actual blur instead of drawing boxes
- `-o PATH` - Output file path

### `preview-watermark` - Test Copyright Overlay

```bash
# Default watermark (center of screen)
race-processor preview-watermark image.jpg

# Custom position (10% from left, 90% from top)
race-processor preview-watermark image.jpg --x-pct 10 --y-pct 90

# Custom text
race-processor preview-watermark image.jpg --text "© 2026 My Race"
```

Options:
- `--text TEXT` - Custom copyright text (use `{year}` for current year)
- `--x-pct FLOAT` - Horizontal position % (0-100, default: 55.0)
- `--y-pct FLOAT` - Vertical position % (0-100, default: 70.0)
- `-o PATH` - Output file path

### `preview-resize` - Test Quality Tiers

```bash
# Creates: image-thumb.jpg, image-medium.jpg, image-full.jpg
race-processor preview-resize image.jpg

# Output to specific directory
race-processor preview-resize image.jpg -o ./output/
```

Options:
- `-o PATH` - Output directory

### `preview-export` - Test WebP Encoding

```bash
# Creates: image.webp
race-processor preview-export image.jpg

# Custom quality settings
race-processor preview-export image.jpg --webp-quality 70
```

Options:
- `--webp-quality INT` - WebP quality 0-100 (default: 80)
- `-o PATH` - Output directory

### `check-exif` - Verify Privacy

```bash
# Check single image
race-processor check-exif image.jpg

# Check entire directory
race-processor check-exif ./output/final/
```

### `override-gps` - Override GPS from GPX Track

Override image GPS data (latitude, longitude, heading) using an external GPX track file. Useful when the camera's built-in GPS is unreliable but you have accurate GPS data from a separate device (e.g., GPS watch).

```bash
# Basic usage (first photo = first GPX point)
race-processor override-gps ./output/intake/metadata.json ./track.gpx

# Camera started 2 seconds after GPX recording began
race-processor override-gps ./metadata.json ./track.gpx --offset 2

# Camera started 3 seconds before GPX recording began
race-processor override-gps ./metadata.json ./track.gpx --offset -3

# Debug mode to see detailed matching info
race-processor override-gps ./metadata.json ./track.gpx --debug

# Save to different file instead of overwriting
race-processor override-gps ./metadata.json ./track.gpx -o ./metadata-updated.json
```

Options:
- `--offset FLOAT` - Time offset in seconds between GPX start and first photo (default: 0)
- `--max-time-diff FLOAT` - Warning threshold in seconds (default: 60)
- `--debug` - Enable detailed logging for each image
- `-o PATH` - Output path (default: overwrites input manifest)

**How it works:**
1. Assumes the first photo corresponds to the first GPX point (plus offset)
2. For each subsequent photo, calculates elapsed time since the first photo
3. Matches to the GPX point at the same elapsed time from GPX start
4. Overrides latitude, longitude, and altitude from GPX
5. Calculates all heading fields for Street View-like navigation:
   - `heading_degrees`: Direction of travel (from current GPX point to next second's point)
   - `heading_to_prev`: Bearing to previous image (for back arrow)
   - `heading_to_next`: Bearing to next image (for forward arrow)

**Offset Explanation:**
- `--offset 0`: First photo taken at same time GPX recording started (default)
- `--offset 2`: You pressed the GPS watch first, waited 2 seconds, then started camera
- `--offset -2`: You started camera first, then pressed GPS watch 2 seconds later

### `process-gpx` - Simplify GPX for Web Display

Process a GPX track file into simplified data for minimap and elevation display.

```bash
# Basic usage (creates track-processed.json)
race-processor process-gpx track.gpx

# Custom output and 300 points
race-processor process-gpx track.gpx -o route.json --points 300

# Use RDP algorithm (preserves shape better for curvy routes)
race-processor process-gpx track.gpx --method rdp
```

Options:
- `-o PATH` - Output JSON path (default: `{input}-processed.json`)
- `--points INT` - Target number of points for polyline (default: 200)
- `--elevation-samples INT` - Number of samples for elevation profile (default: 100)
- `--method` - Simplification method: `uniform` (distance-based) or `rdp` (shape-based)
- `--debug` - Enable debug output

**Output format:**
```json
{
  "polyline": [{"lat": 22.285, "lon": 114.157}, ...],
  "bounds": {"north": 22.3, "south": 22.2, "east": 114.2, "west": 114.1},
  "elevation_profile": [{"distance_km": 0, "elevation_m": 15.3}, ...],
  "total_distance_km": 42.19,
  "stats": {
    "original_points": 15000,
    "simplified_points": 200,
    "total_gain_m": 450,
    "total_loss_m": 420
  }
}
```

### `db` - Database Management Commands

Manage race data in the PostgreSQL database. Requires `DATABASE_URL` environment variable.

#### `db init` - Initialize Schema

```bash
race-processor db init
race-processor db init --schema ./custom-schema.sql
```

#### `db insert` - Insert Race from Config

```bash
# Insert from YAML or JSON config file
race-processor db insert race-config.yaml

# Update if race already exists
race-processor db insert race.json --update
```

Example config file (`race-config.yaml`):
```yaml
slug: hk-marathon-2026
name: Hong Kong Marathon 2026
description: The iconic Hong Kong Marathon route
distance_meters: 42195
capture_date: 2026-01-15
capture_device: Insta360 X4
recorded_by: Angus Yip
city: Hong Kong
country: Hong Kong SAR
flag_emoji: "\U0001F1ED\U0001F1F0"  # 🇭🇰
storage_bucket: my-bucket
storage_prefix: races/hk-marathon-2026/
status: pending
```

#### `db list` - List All Races

```bash
race-processor db list
race-processor db list --status ready
race-processor db list --json
```

#### `db get` - Get Race Details

```bash
race-processor db get hk-marathon-2026
race-processor db get <uuid> --json
```

#### `db update` - Update Race

```bash
race-processor db update hk-marathon-2026 updated-config.yaml
```

#### `db delete` - Delete Race

```bash
race-processor db delete hk-marathon-2026
race-processor db delete hk-marathon-2026 --yes  # Skip confirmation
```

### `r2` - R2 Storage Management Commands

#### `r2 delete` - Delete Images from R2

Delete all images associated with a race from Cloudflare R2.

```bash
# Basic usage
race-processor r2 delete hk-marathon-2026

# Skip confirmation
race-processor r2 delete hk-marathon-2026 --yes

# Custom storage prefix
race-processor r2 delete hk-marathon-2026 --prefix custom/path/
```

Options:
- `--yes, -y` - Skip confirmation prompt
- `--prefix TEXT` - Override storage prefix (default: `races/{race_slug}`)

## Commands

### `process` - Main Processing Pipeline

```bash
race-processor process [OPTIONS]
```

The `process` command supports two modes:

1. **Standard Mode**: Full pipeline (requires `-i` and `-r`)
2. **Direct Mode**: Process arbitrary images directly (uses `--src` and `--dst`)

#### Standard Mode Options

| Option | Description |
|--------|-------------|
| `-i, --input PATH` | Input directory containing equirectangular images |
| `-r, --race-slug TEXT` | URL-friendly race identifier (e.g., `hk-marathon-2026`) |
| `-o, --output PATH` | Output directory (default: `./output`) |
| `-w, --workers INT` | Number of parallel workers (default: `4`) |

#### Direct Mode Options

| Option | Description |
|--------|-------------|
| `--src PATH` | Source directory or single image file |
| `--dst PATH` | Destination directory for output |

#### Pipeline Control

| Option | Description |
|--------|-------------|
| `--skip-blur` | Skip privacy blur stage |
| `--upload` | Run R2 upload stage (default: skipped) |
| `--upload-prefix TEXT` | Override R2 storage prefix (default: `races/{race_slug}`) |

#### Blur Mode

| Option | Default | Description |
|--------|---------|-------------|
| `--blur-mode` | `full` | Detection mode for blur stage |
| `--conf` | `0.12` | Confidence threshold for detections |

Blur modes:
- `full` - Use YOLO models for real face/plate detection (default)
- `skip` - Skip blur entirely (same as `--skip-blur`)

#### Debug Mode

| Option | Default | Description |
|--------|---------|-------------|
| `--debug` | off | Save intermediate images at each step |
| `--debug-format` | `jpg` | Format for debug images: `jpg`, `png`, `tiff` |

#### Step Control

| Option | Default | Description |
|--------|---------|-------------|
| `--start-step INT` | `1` | Start processing from this step (1-6) |
| `--end-step INT` | `6` | Stop processing after this step (1-6) |
| `--step INT` | - | Run only this single step |
| `--single-image TEXT` | - | Process only this specific image filename |

#### Copyright Watermark

| Option | Default | Description |
|--------|---------|-------------|
| `--copyright-text TEXT` | `© {year} Prologue.run` | Custom copyright text. Use `{year}` for current year |

### `intake` - Preview Image Ordering

```bash
race-processor intake PATH [--race-slug TEXT]
```

Preview how images will be sorted by EXIF timestamp without running the full pipeline.

## Examples

### Basic Processing

```bash
# Process a race with all steps
race-processor process -i ./exported-images -r hk-marathon-2026
```

### Debug Mode

```bash
# Enable debug mode to save intermediate images
race-processor process -i ./exported-images -r hk-marathon-2026 --debug

# Use PNG format for lossless debug output
race-processor process -i ./exported-images -r hk-marathon-2026 --debug --debug-format png
```

### Step Control

```bash
# Run only the blur step (step 2)
race-processor process -i ./exported-images -r hk-marathon-2026 --step 2

# Run steps 2 through 4 (blur, watermark, resize)
race-processor process -i ./exported-images -r hk-marathon-2026 --start-step 2 --end-step 4
```

### Direct Mode (Testing Individual Steps)

```bash
# Test blur (step 2) on a folder of JPEG images
race-processor process --step 2 --src ./testing-images --dst ./blur-output

# Test watermark (step 3) on a single image
race-processor process --step 3 --src ./my-image.jpg --dst ./watermark-output

# Run steps 2-4 on a folder with debug output
race-processor process --start-step 2 --end-step 4 \
    --src ./equirect-images --dst ./processed --debug
```

## Input Directory Structure

```
exported-images/
├── IMG_20260112_182529_00_001.jpg    # Equirectangular from Insta360 Studio
├── IMG_20260112_182530_00_002.jpg
└── ...
```

Images can have any filename - they will be sorted by EXIF timestamp during intake and renamed to `001.jpg`, `002.jpg`, etc.

## Output Directory Structure

```
output/hk-marathon-2026/
├── intake/                 # Renamed images + metadata.json
│   ├── 001.jpg
│   ├── 002.jpg
│   └── metadata.json       # EXIF data (GPS, timestamps)
├── blurred/                # After privacy blur
├── watermarked/            # After copyright watermark
├── resized/                # Quality tiers
│   ├── thumbnail/          # 512px width
│   ├── medium/             # 2048px width
│   └── full/               # 4096px width
├── final/                  # Encoded WebP images
│   ├── thumb/              # WebP thumbnails
│   ├── medium/             # WebP medium quality
│   └── full/               # WebP full quality
├── db_records.json         # Ready for database insertion
└── debug/                  # Debug output (when --debug enabled)
```

## Metadata Flow

1. **Intake**: EXIF data (GPS, timestamp, altitude) is extracted and saved to `metadata.json`
2. **Blur**: EXIF is stripped during blur processing (privacy protection)
3. **Upload**: `db_records.json` contains all metadata for database insertion

The `metadata.json` format:
```json
{
  "race_slug": "hk-marathon-2026",
  "total_images": 500,
  "images": [
    {
      "position_index": 0,
      "original_filename": "IMG_20260112_182529_00_001.jpg",
      "captured_at": "2026-01-12T18:25:29",
      "latitude": 22.2855637,
      "longitude": 114.1576957,
      "altitude_meters": 15.3,
      "heading_degrees": 36.51,
      "heading_to_prev": 216.51,
      "heading_to_next": 38.23
    }
  ]
}
```

**Heading fields for Street View-like navigation:**
- `heading_degrees`: Direction of travel (from GPX or EXIF-based calculation)
- `heading_to_prev`: Bearing to previous image (for back arrow in UI)
- `heading_to_next`: Bearing to next image (for forward arrow in UI)

> **Note:** During intake, headings are calculated from EXIF GPS (image-to-image). For more accurate direction of travel, use `override-gps` with GPX data (calculates from fine-grained GPS points).

## Configuration

### Image Tiers

| Tier | Width | WebP Quality |
|------|-------|--------------|
| thumbnail | 512px | 70 |
| medium | 2048px | 75 |
| full | 4096px | 80 |

### Copyright Watermark

| Setting | Default |
|---------|---------|
| Text | `© {year} Prologue.run` |
| Position | bottom-left |
| Font size | 1.2% of image height |
| Color | White with 70% opacity |
| Shadow | Black with 47% opacity, 2px offset |

## Troubleshooting

### "No images found"

Ensure your input directory contains `.jpg`, `.jpeg`, or `.png` files.

### Model not found errors

Download the required models manually (see [Required Models](#required-models) section) and place them in `race-processor/models/`.

### "Found GPS data in X files" (during upload)

The privacy sanity check found GPS EXIF data in output images. This should not happen if blur was applied. Check that:
1. Blur step was not skipped
2. Images were processed correctly

### Images not sorted correctly

Check that your source images have valid EXIF timestamps. Use `race-processor intake ./path` to preview the ordering.

### WebP encoding fails

Ensure Pillow is installed with WebP support:
```bash
pip install Pillow
```

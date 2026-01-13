# Race Processor Usage Manual

A CLI tool for processing 360° images from Insta360 X4 cameras into web-optimized, privacy-protected panoramic images.

## Installation

```bash
cd race-processor
pip install -e .
```

## Quick Start

```bash
# Basic processing
race-processor process -i ./data/my-race -r my-race-2026

# With debug output to inspect each step
race-processor process -i ./data/my-race -r my-race-2026 --debug

# Process only the watermark step
race-processor process -i ./data/my-race -r my-race-2026 --step 5
```

## Pipeline Steps

The processor runs an 8-stage pipeline:

| Step | Name       | Description                                      |
|------|------------|--------------------------------------------------|
| 1    | Ingest     | Discover .insp files and create processing manifest |
| 2    | Stabilize  | Extract gyro data and calculate corrections     |
| 3    | Stitch     | Convert to equirectangular with stabilization   |
| 4    | Blur       | Apply privacy blurring (faces, license plates)  |
| 5    | Watermark  | Add copyright text overlay                      |
| 6    | Resize     | Generate quality tiers (512px, 2048px, 4096px)  |
| 7    | Export     | Encode to AVIF/WebP formats                     |
| 8    | Upload     | Upload to Cloudflare R2 storage                 |

## Commands

### `process` - Main Processing Pipeline

```bash
race-processor process [OPTIONS]
```

#### Required Options

| Option | Description |
|--------|-------------|
| `-i, --input PATH` | Input directory containing `insp/` and `gpx/` subdirectories |
| `-r, --race-slug TEXT` | URL-friendly race identifier (e.g., `hk-marathon-2026`) |

#### Output Options

| Option | Default | Description |
|--------|---------|-------------|
| `-o, --output PATH` | `./output` | Output directory |
| `-w, --workers INT` | `4` | Number of parallel workers |

#### Pipeline Control

| Option | Description |
|--------|-------------|
| `--skip-blur` | Skip privacy blur stage |
| `--skip-upload` | Skip R2 upload stage |
| `--use-sdk / --use-cli` | Use Insta360 SDK (default) or Studio CLI |

#### Debug Mode

| Option | Default | Description |
|--------|---------|-------------|
| `--debug` | off | Save intermediate images at each step |
| `--debug-format` | `jpg` | Format for debug images: `jpg`, `png`, `tiff` |

#### Step Control

| Option | Default | Description |
|--------|---------|-------------|
| `--start-step INT` | `1` | Start processing from this step (1-8) |
| `--end-step INT` | `8` | Stop processing after this step (1-8) |
| `--step INT` | - | Run only this single step (shorthand for `--start-step N --end-step N`) |
| `--single-image TEXT` | - | Process only this specific image filename |

#### Copyright Watermark

| Option | Default | Description |
|--------|---------|-------------|
| `--copyright-text TEXT` | `© {year} Prologue.run` | Custom copyright text. Use `{year}` for current year |

### `ingest` - Discover Files

```bash
race-processor ingest PATH [--race-slug TEXT]
```

Discovers .insp files and creates a processing manifest without running the full pipeline.

### `validate` - Validate Filenames

```bash
race-processor validate PATH
```

Validates that .insp filenames match the expected Insta360 X4 naming pattern.

### `download-models` - Download AI Models

```bash
race-processor download-models
```

Downloads YOLO models required for privacy blur detection.

### `preview-blur` - Preview Blur Detection

```bash
race-processor preview-blur IMAGE_PATH
```

Preview blur detection on a single image without processing.

### `generate-card-assets` - Generate Landing Page Assets

```bash
race-processor generate-card-assets -i PATH -r RACE_SLUG
```

Generate elevation profile and route SVG for landing page cards.

## Examples

### Basic Processing

```bash
# Process a race with all steps
race-processor process -i ./data/hk-marathon -r hk-marathon-2026
```

### Debug Mode

```bash
# Enable debug mode to save intermediate images
race-processor process -i ./data/hk-marathon -r hk-marathon-2026 --debug

# Use PNG format for lossless debug output
race-processor process -i ./data/hk-marathon -r hk-marathon-2026 --debug --debug-format png
```

Debug output is saved to:
```
output/hk-marathon-2026/debug/
├── manifest.json           # Processing manifest (step 1)
├── step3_stitch/           # Stitched equirectangular images
├── step4_blur/             # After privacy blur
├── step5_watermark/        # After copyright watermark
└── step6_resize/           # After resizing (with tier suffixes)
    ├── image_001_thumbnail.jpg
    ├── image_001_medium.jpg
    └── image_001_full.jpg
```

### Step Control

```bash
# Run only the watermark step (step 5)
race-processor process -i ./data/hk-marathon -r hk-marathon-2026 --step 5

# Run steps 4 through 6 (blur, watermark, resize)
race-processor process -i ./data/hk-marathon -r hk-marathon-2026 --start-step 4 --end-step 6

# Process a single image through specific steps
race-processor process -i ./data/hk-marathon -r hk-marathon-2026 \
    --step 5 \
    --single-image IMG_20260112_182529_00_328.insp
```

### Custom Copyright

```bash
# Use custom copyright text
race-processor process -i ./data/hk-marathon -r hk-marathon-2026 \
    --copyright-text "© {year} Hong Kong Marathon"

# The {year} placeholder is replaced with the current year
```

### Skip Stages

```bash
# Skip blur (useful for testing or when models aren't installed)
race-processor process -i ./data/hk-marathon -r hk-marathon-2026 --skip-blur

# Skip upload (process locally only)
race-processor process -i ./data/hk-marathon -r hk-marathon-2026 --skip-upload
```

### Combined Options

```bash
# Full debug workflow for a single image
race-processor process -i ./data/hk-marathon -r hk-marathon-2026 \
    --debug \
    --debug-format png \
    --single-image IMG_20260112_182529_00_328.insp \
    --skip-blur \
    --skip-upload
```

## Input Directory Structure

```
data/hk-marathon/
├── insp/                   # Raw .insp files from Insta360 X4
│   ├── IMG_20260112_182529_00_001.insp
│   ├── IMG_20260112_182530_00_002.insp
│   └── ...
└── gpx/                    # Optional GPX track file
    └── route.gpx
```

### .insp Filename Format

Files must follow the Insta360 X4 naming convention:
```
IMG_YYYYMMDD_HHMMSS_CC_NNN.insp
```

| Field | Description |
|-------|-------------|
| `YYYYMMDD` | Capture date |
| `HHMMSS` | Capture time |
| `CC` | Camera index (00 = front) |
| `NNN` | Sequence number |

## Output Directory Structure

```
output/hk-marathon-2026/
├── equirect/               # Stitched equirectangular images
├── blurred/                # After privacy blur
├── watermarked/            # After copyright watermark
├── resized/                # Quality tiers
│   ├── thumbnail/          # 512px width
│   ├── medium/             # 2048px width
│   └── full/               # 4096px width
├── final/                  # Encoded AVIF/WebP
└── debug/                  # Debug output (when --debug enabled)
```

## Configuration

Default settings can be overridden via the CLI or programmatically:

### Image Tiers

| Tier | Width | AVIF Quality | WebP Quality |
|------|-------|--------------|--------------|
| thumbnail | 512px | 60 | 70 |
| medium | 2048px | 70 | 75 |
| full | 4096px | 75 | 80 |

### Copyright Watermark

| Setting | Default |
|---------|---------|
| Text | `© {year} Prologue.run` |
| Position | bottom-left |
| Font size | 1.2% of image height |
| Color | White with 70% opacity |
| Shadow | Black with 47% opacity, 2px offset |

## Troubleshooting

### "No valid .insp files found"

Ensure your input directory has an `insp/` subdirectory containing `.insp` files, or contains `.insp` files directly.

### "YOLO models required"

Run `race-processor download-models` to download the AI models needed for privacy blur.

### "Insta360 SDK integration required"

Steps 2-3 (Stabilize/Stitch) require the Insta360 SDK. Place pre-stitched equirectangular images in `output/{race}/equirect/` and start from step 4:

```bash
race-processor process -i ./data/my-race -r my-race --start-step 4
```

### Debug mode not showing images

Ensure there are source images in the expected directories:
- Step 4+: `output/{race}/equirect/`
- Step 5+: `output/{race}/blurred/`
- Step 6+: `output/{race}/watermarked/`

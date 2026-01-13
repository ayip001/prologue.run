# Race Processor Usage Manual

A CLI tool for processing 360° images from Insta360 X4 cameras into web-optimized, privacy-protected panoramic images. Note: This will be pretty much useless to you unless you have a similar setup to mine: Insta360 X4, Windows 11, NVIDIA GeForce RTX 2070

## Installation

```bash
cd race-processor
pip install -e .
```

## Quick Start

```bash
# Basic processing (standard mode)
race-processor process -i ./data/my-race -r my-race-2026

# With debug output to inspect each step
race-processor process -i ./data/my-race -r my-race-2026 --debug

# Process only the watermark step
race-processor process -i ./data/my-race -r my-race-2026 --step 5

# Direct mode: test blur on arbitrary JPEG files
race-processor process --step 4 --src ./my-images --dst ./output-test

# Direct mode: test watermark on a single image
race-processor process --step 5 --src ./image.jpg --dst ./output
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

The `process` command supports two modes:

1. **Standard Mode**: Full pipeline with race directory structure (requires `-i` and `-r`)
2. **Direct Mode**: Process arbitrary images directly (uses `--src` and `--dst`)

#### Standard Mode Options

| Option | Description |
|--------|-------------|
| `-i, --input PATH` | Input directory containing `insp/` and `gpx/` subdirectories |
| `-r, --race-slug TEXT` | URL-friendly race identifier (e.g., `hk-marathon-2026`) |
| `-o, --output PATH` | Output directory (default: `./output`) |
| `-w, --workers INT` | Number of parallel workers (default: `4`) |

#### Direct Mode Options

Direct mode bypasses the standard directory structure and processes arbitrary images.
Useful for testing individual pipeline steps on pre-processed images.

| Option | Description |
|--------|-------------|
| `--src PATH` | Source directory or single image file |
| `--dst PATH` | Destination directory for output |

When using `--src`, the `-i` and `-r` options are not required.

#### Pipeline Control

| Option | Description |
|--------|-------------|
| `--skip-blur` | Skip privacy blur stage |
| `--skip-upload` | Skip R2 upload stage |
| `--use-sdk / --use-cli` | Use Insta360 SDK (default) or Studio CLI |

#### Blur Mode

| Option | Default | Description |
|--------|---------|-------------|
| `--blur-mode` | `demo` | Detection mode for blur stage |

Blur modes:
- `full` - Use YOLO models for real face/plate detection (requires `download-models`)
- `demo` - Generate fake detections for testing the pipeline
- `skip` - Skip blur entirely (same as `--skip-blur`)

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

### Direct Mode (Testing Individual Steps)

Direct mode allows you to test individual pipeline steps on arbitrary images without
the full race directory structure. Great for debugging and development.

```bash
# Test blur (step 4) on a folder of JPEG images
race-processor process --step 4 --src ./testing-images --dst ./blur-output

# Test watermark (step 5) on a single image
race-processor process --step 5 --src ./my-image.jpg --dst ./watermark-output

# Run steps 4-6 on a folder with debug output
race-processor process --start-step 4 --end-step 6 \
    --src ./equirect-images --dst ./processed --debug

# Test blur with demo mode (fake detections for testing)
race-processor process --step 4 --src ./images --dst ./output --blur-mode demo

# Test blur with actual YOLO models
race-processor process --step 4 --src ./images --dst ./output --blur-mode full
```

Direct mode output structure:
```
output/
├── step4_blur/           # Blurred images
├── step5_watermark/      # Watermarked images
├── step6_resize/         # Resized images
│   ├── thumbnail/
│   ├── medium/
│   └── full/
└── debug/                # Debug output (if --debug enabled)
```

### Blur Mode Testing

```bash
# Demo mode: generates fake blur regions for testing the pipeline
race-processor process -i ./data/race -r race --blur-mode demo

# Full mode: uses YOLO models for real detection (requires download-models)
race-processor process -i ./data/race -r race --blur-mode full

# Skip mode: no blur applied
race-processor process -i ./data/race -r race --blur-mode skip
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

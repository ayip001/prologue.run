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
| 5    | Export    | Encode to AVIF/WebP formats                        |
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
# Default watermark
race-processor preview-watermark image.jpg

# Custom text
race-processor preview-watermark image.jpg --text "© 2026 My Race"
```

Options:
- `--text TEXT` - Custom copyright text (use `{year}` for current year)
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

### `preview-export` - Test AVIF/WebP Encoding

```bash
# Creates: image.avif, image.webp
race-processor preview-export image.jpg

# Custom quality settings
race-processor preview-export image.jpg --avif-quality 60 --webp-quality 70
```

Options:
- `--avif-quality INT` - AVIF quality 0-100 (default: 75)
- `--webp-quality INT` - WebP quality 0-100 (default: 80)
- `-o PATH` - Output directory

### `check-exif` - Verify Privacy

```bash
# Check single image
race-processor check-exif image.jpg

# Check entire directory
race-processor check-exif ./output/final/
```

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
| `--skip-upload` | Skip R2 upload stage |

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
├── final/                  # Encoded formats
│   ├── thumb/              # AVIF thumbnails
│   ├── thumb_webp/         # WebP fallbacks
│   ├── medium/
│   ├── medium_webp/
│   ├── full/
│   └── full_webp/
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
      "altitude_meters": 15.3
    }
  ]
}
```

## Configuration

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

### AVIF encoding fails

Ensure `pillow-avif-plugin` is installed:
```bash
pip install pillow-avif-plugin
```

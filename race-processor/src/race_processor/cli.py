"""
Command-line interface for the race processor pipeline.
"""

import click
from pathlib import Path
from datetime import datetime
from rich.console import Console

from .config import (
    PipelineConfig,
    DEFAULT_OUTPUT_DIR,
    DebugConfig,
    StepControlConfig,
    CopyrightConfig,
    R2Config,
)

console = Console()


def load_r2_config() -> R2Config | None:
    """Load R2 configuration from environment variables."""
    import os
    from dotenv import load_dotenv

    # Try to load .env.local first, then .env from workspace root
    # cli.py is at race-processor/src/race_processor/cli.py
    # Root is 4 levels up
    root_dir = Path(__file__).parent.parent.parent.parent
    env_loaded = False

    for env_file in [".env.local", ".env"]:
        env_path = root_dir / env_file
        if env_path.exists():
            load_dotenv(env_path)
            env_loaded = True
            break

    endpoint = os.getenv("R2_ENDPOINT")
    access_key = os.getenv("R2_ACCESS_KEY_ID")
    secret_key = os.getenv("R2_SECRET_ACCESS_KEY")
    bucket = os.getenv("R2_BUCKET_NAME")

    if all([endpoint, access_key, secret_key, bucket]):
        return R2Config(
            endpoint=endpoint,  # type: ignore
            access_key_id=access_key,  # type: ignore
            secret_access_key=secret_key,  # type: ignore
            bucket=bucket,  # type: ignore
        )
    return None


@click.group()
@click.version_option()
def main() -> None:
    """Race Processor - Image processing pipeline for 360° race route viewer."""
    pass


@main.command()
@click.option(
    "--input",
    "-i",
    "input_dir",
    type=click.Path(exists=True, file_okay=False, path_type=Path),
    default=None,
    help="Input directory containing equirectangular images (exported from Insta360 Studio)",
)
@click.option(
    "--race-slug",
    "-r",
    default=None,
    help="URL-friendly race identifier (e.g., 'hk-marathon-2026')",
)
@click.option(
    "--output",
    "-o",
    "output_dir",
    type=click.Path(file_okay=False, path_type=Path),
    default=DEFAULT_OUTPUT_DIR,
    help="Output directory",
)
@click.option(
    "--src",
    type=click.Path(exists=True, path_type=Path),
    default=None,
    help="Source directory or file for direct processing (bypasses standard structure)",
)
@click.option(
    "--dst",
    type=click.Path(path_type=Path),
    default=None,
    help="Destination directory for direct processing output",
)
@click.option(
    "--workers",
    "-w",
    default=4,
    help="Number of parallel workers",
)
@click.option(
    "--skip-blur",
    is_flag=True,
    help="Skip privacy blur stage",
)
@click.option(
    "--upload",
    "run_upload",
    is_flag=True,
    default=False,
    help="Run R2 upload stage (default: skipped)",
)
@click.option(
    "--upload-prefix",
    default=None,
    help="R2 storage prefix (default: races/{race_slug})",
)
@click.option(
    "--blur-mode",
    type=click.Choice(["full", "skip"]),
    default="full",
    help="Blur detection mode: full (requires models), skip (no blur)",
)
@click.option(
    "--conf",
    type=float,
    default=0.12,
    help="Confidence threshold for blur detection (default: 0.12)",
)
@click.option(
    "--debug",
    is_flag=True,
    help="Enable debug mode to save intermediate images at each step",
)
@click.option(
    "--debug-format",
    type=click.Choice(["jpg", "png", "tiff"]),
    default="jpg",
    help="Output format for debug images (default: jpg)",
)
@click.option(
    "--start-step",
    type=click.IntRange(1, 6),
    default=1,
    help="Start processing from this step (1-6). Steps: 1=Intake, 2=Blur, 3=Watermark, 4=Resize, 5=Export, 6=Upload",
)
@click.option(
    "--end-step",
    type=click.IntRange(1, 6),
    default=6,
    help="Stop processing after this step (1-6)",
)
@click.option(
    "--step",
    type=click.IntRange(1, 6),
    default=None,
    help="Run only this single step (shorthand for --start-step N --end-step N)",
)
@click.option(
    "--single-image",
    default=None,
    help="Process only this specific image filename",
)
@click.option(
    "--copyright-text",
    default=None,
    help="Custom copyright text (default: '© {year} Prologue.run'). Use {year} for current year.",
)
@click.option(
    "--gpx",
    "gpx_path",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
    default=None,
    help="Path to GPX track file for GPS override",
)
@click.option(
    "--gpx-offset",
    type=float,
    default=0.0,
    help="Time offset in seconds between GPX start and first photo (default: 0)",
)
@click.option(
    "--skip-first",
    type=int,
    default=0,
    help="Skip the first N images during intake (useful if you started recording before the start line)",
)
def process(
    input_dir: Path | None,
    race_slug: str | None,
    output_dir: Path,
    src: Path | None,
    dst: Path | None,
    workers: int,
    skip_blur: bool,
    run_upload: bool,
    upload_prefix: str | None,
    blur_mode: str,
    conf: float,
    debug: bool,
    debug_format: str,
    start_step: int,
    end_step: int,
    step: int | None,
    single_image: str | None,
    copyright_text: str | None,
    gpx_path: Path | None,
    gpx_offset: float,
    skip_first: int,
) -> None:
    """Process equirectangular images through the pipeline.

    \b
    Pipeline Steps:
      1. Intake    - Import images, extract EXIF, sort by timestamp, rename sequentially
      2. Blur      - Apply privacy blurring (faces, plates)
      3. Watermark - Add copyright text overlay
      4. Resize    - Generate quality tiers (thumbnail, medium, full)
      5. Export    - Encode to WebP format
      6. Upload    - Privacy check, upload to R2, generate DB records

    \b
    Standard Mode (requires -i and -r):
      race-processor process -i ./exported-images -r my-race --debug

    \b
    Direct Mode (--src/--dst for testing individual steps):
      # Test blur on a folder of JPEGs
      race-processor process --step 2 --src ./testing-jpg --dst ./blurred-test

      # Test watermark on a single image
      race-processor process --step 3 --src ./img.jpg --dst ./output/

    \b
    Blur Modes:
      --blur-mode full   Use YOLO models for real detection (default)
      --blur-mode skip   Skip blur entirely
    """
    # Direct processing mode (--src/--dst)
    if src is not None:
        if dst is None:
            console.print("[red]Error: --dst is required when using --src[/]")
            raise SystemExit(1)

        # Handle --step shorthand
        if step is not None:
            start_step = step
            end_step = step

        console.print(f"[bold green]Direct processing mode[/]")
        console.print(f"  Source: {src}")
        console.print(f"  Destination: {dst}")
        console.print(f"  Steps: {start_step}-{end_step}")
        console.print(f"  Blur mode: {blur_mode}")
        console.print(f"  Confidence: {conf}")

        from .pipeline.orchestrator import run_direct_processing

        # Try to load R2 config for upload step in direct mode if requested
        r2_config = load_r2_config() if run_upload else None

        run_direct_processing(
            src=src,
            dst=dst,
            start_step=start_step,
            end_step=end_step,
            blur_mode=blur_mode,
            blur_conf=conf,
            debug=debug,
            debug_format=debug_format,
            single_image=single_image,
            copyright_text=copyright_text,
            r2_config=r2_config,
            upload_prefix=upload_prefix,
        )
        return

    # Standard pipeline mode (requires -i and -r)
    if input_dir is None:
        console.print("[red]Error: --input/-i is required (or use --src/--dst for direct mode)[/]")
        raise SystemExit(1)
    if race_slug is None:
        console.print("[red]Error: --race-slug/-r is required (or use --src/--dst for direct mode)[/]")
        raise SystemExit(1)

    console.print(f"[bold green]Processing race:[/] {race_slug}")
    console.print(f"  Input: {input_dir}")
    console.print(f"  Output: {output_dir}")
    console.print(f"  Workers: {workers}")
    console.print(f"  Blur mode: {blur_mode}")
    console.print(f"  Confidence: {conf}")
    console.print(f"  Upload: {'[green]Yes[/]' if run_upload else '[yellow]No[/]'}")
    if upload_prefix:
        console.print(f"  Upload prefix: {upload_prefix}")

    # Handle --step shorthand
    if step is not None:
        start_step = step
        end_step = step

    # Build debug config
    debug_config = DebugConfig(
        enabled=debug,
        output_format=debug_format,
    )

    # Build step control config
    step_control = StepControlConfig(
        start_step=start_step,
        end_step=end_step,
        single_image=single_image,
    )

    # Build copyright config
    copyright_config = CopyrightConfig()
    if copyright_text:
        copyright_config = CopyrightConfig(text=copyright_text)

    # Load R2 config
    r2_config = load_r2_config()

    config = PipelineConfig(
        input_dir=input_dir,
        output_dir=output_dir,
        race_slug=race_slug,
        workers=workers,
        skip_blur=skip_blur,
        skip_upload=not run_upload,
        upload_prefix=upload_prefix,
        debug=debug_config,
        step_control=step_control,
        copyright=copyright_config,
        r2=r2_config,
        gpx_path=gpx_path,
        gpx_offset=gpx_offset,
        skip_first=skip_first,
    )

    # Import and run orchestrator
    from .pipeline.orchestrator import run_pipeline

    run_pipeline(config, blur_mode=blur_mode, blur_conf=conf)


@main.command()
@click.argument(
    "input_dir",
    type=click.Path(exists=True, file_okay=False, path_type=Path),
)
@click.option(
    "--race-slug",
    "-r",
    required=True,
    help="URL-friendly race identifier (e.g., 'hk-marathon-2026')",
)
def intake(input_dir: Path, race_slug: str) -> None:
    """Preview intake step: extract EXIF and show image ordering.

    This command runs only the intake step to preview how images
    will be sorted and what EXIF data is available.
    """
    console.print(f"[bold]Previewing intake for:[/] {input_dir}")

    from .pipeline.intake import run_intake
    import tempfile

    with tempfile.TemporaryDirectory() as tmpdir:
        manifest = run_intake(input_dir, Path(tmpdir), race_slug)

        if manifest:
            console.print(f"\n[green]Would process {manifest.total_images} images[/]")
        else:
            console.print("[red]No images found[/]")


@main.command("preview-blur")
@click.argument(
    "image_path",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
)
@click.option(
    "--output",
    "-o",
    type=click.Path(dir_okay=False, path_type=Path),
    default=None,
    help="Output preview image (default: {input}-blur-preview.jpg)",
)
@click.option(
    "--show-sources",
    is_flag=True,
    help="Color-code detections by source",
)
@click.option(
    "--blur",
    is_flag=True,
    help="Apply actual blur effect instead of drawing boxes",
)
@click.option(
    "--conf",
    type=float,
    default=0.12,
    help="Confidence threshold for detections (default: 0.12)",
)
def preview_blur(image_path: Path, output: Path | None, show_sources: bool, blur: bool, conf: float) -> None:
    """Preview blur detection on a single image.

    \b
    Examples:
      # Show detection boxes
      race-processor preview-blur image.jpg --conf 0.05 --show-sources

      # Apply actual blur
      race-processor preview-blur image.jpg --blur --conf 0.1
    """
    console.print(f"[bold]Preview blur {'effect' if blur else 'detection'} for:[/] {image_path}")

    from .detection.ensemble import PrivacyBlurEnsemble, blur_image
    from .config import DEFAULT_MODELS_DIR, BlurConfig
    import cv2

    # Default output path
    if output is None:
        output = image_path.parent / f"{image_path.stem}-blur-preview.jpg"

    # Load image
    image = cv2.imread(str(image_path))
    if image is None:
        console.print("[red]Error: Could not load image[/]")
        return

    console.print(f"  Image size: {image.shape[1]}x{image.shape[0]}")

    # Run detection
    ensemble = PrivacyBlurEnsemble(models_dir=DEFAULT_MODELS_DIR, conf_threshold=conf)
    regions = ensemble.detect_all(image)

    console.print(f"  Detected {len(regions)} regions (threshold: {conf})")

    # Print detection details
    for region in regions:
        console.print(f"    - {region.source.value}: {region.confidence:.3f} at ({region.x}, {region.y}) {region.width}x{region.height}")

    if blur:
        # Apply actual blur
        config = BlurConfig()
        result = blur_image(image, regions, config)
    else:
        # Draw bounding boxes
        result = image.copy()
        for region in regions:
            x1 = region.x - region.width // 2
            y1 = region.y - region.height // 2
            x2 = region.x + region.width // 2
            y2 = region.y + region.height // 2

            # Color by source if requested
            if show_sources:
                colors = {
                    "face_yolo_n": (0, 255, 0),      # Green
                    "face_yolo_m": (0, 200, 0),      # Dark Green
                    "body_pose_head": (255, 0, 0),   # Blue
                    "plate": (0, 0, 255),            # Red
                    "vehicle": (255, 255, 0),        # Cyan
                }
                color = colors.get(region.source.value, (255, 255, 255))
            else:
                color = (0, 255, 0)

            cv2.rectangle(result, (x1, y1), (x2, y2), color, 2)
            label = f"{region.source.value}: {region.confidence:.2f}"
            cv2.putText(result, label, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)

    # Save output
    cv2.imwrite(str(output), result)
    console.print(f"[green]Output saved to:[/] {output}")


@main.command("preview-watermark")
@click.argument(
    "image_path",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
)
@click.option(
    "--output",
    "-o",
    type=click.Path(dir_okay=False, path_type=Path),
    default=None,
    help="Output preview image (default: {input}-watermark-preview.jpg)",
)
@click.option(
    "--text",
    "-t",
    default=None,
    help="Custom copyright text (default: '© {year} Prologue.run')",
)
@click.option(
    "--x-pct",
    type=float,
    default=55.0,
    help="Horizontal position % (0-100, default: 55.0)",
)
@click.option(
    "--y-pct",
    type=float,
    default=70.0,
    help="Vertical position % (0-100, default: 70.0)",
)
def preview_watermark(image_path: Path, output: Path | None, text: str | None, x_pct: float, y_pct: float) -> None:
    """Preview watermark on a single image.

    \b
    Examples:
      # Default watermark (center)
      race-processor preview-watermark image.jpg

      # Custom position
      race-processor preview-watermark image.jpg --x-pct 10 --y-pct 90

      # Custom text
      race-processor preview-watermark image.jpg --text "© 2026 My Race"
    """
    console.print(f"[bold]Preview watermark for:[/] {image_path}")

    from .pipeline.watermark import process_single_image
    from .config import CopyrightConfig

    # Default output path
    if output is None:
        output = image_path.parent / f"{image_path.stem}-watermark-preview.jpg"

    # Build config
    config = CopyrightConfig(
        position="custom",
        custom_x_pct=x_pct,
        custom_y_pct=y_pct
    )
    if text:
        config.text = text

    year = datetime.now().year
    console.print(f"  Text: {config.text.format(year=year)}")
    console.print(f"  Position: {x_pct}%, {y_pct}%")

    # Process
    success = process_single_image(image_path, output, config)

    if success:
        console.print(f"[green]Output saved to:[/] {output}")
    else:
        console.print("[red]Failed to process image[/]")


@main.command("preview-resize")
@click.argument(
    "image_path",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
)
@click.option(
    "--output-dir",
    "-o",
    type=click.Path(file_okay=False, path_type=Path),
    default=None,
    help="Output directory (default: same as input)",
)
def preview_resize(image_path: Path, output_dir: Path | None) -> None:
    """Preview resize tiers on a single image.

    Creates three output files: {name}-thumb.jpg, {name}-medium.jpg, {name}-full.jpg

    \b
    Examples:
      race-processor preview-resize image.jpg
      race-processor preview-resize image.jpg -o ./output/
    """
    console.print(f"[bold]Preview resize for:[/] {image_path}")

    from .config import ImageTiersConfig
    import cv2

    # Default output directory
    if output_dir is None:
        output_dir = image_path.parent

    output_dir.mkdir(parents=True, exist_ok=True)

    # Load image
    image = cv2.imread(str(image_path))
    if image is None:
        console.print("[red]Error: Could not load image[/]")
        return

    height, width = image.shape[:2]
    console.print(f"  Original size: {width}x{height}")

    # Get tier config
    tier_config = ImageTiersConfig()

    tiers = {
        "thumb": tier_config.thumbnail,
        "medium": tier_config.medium,
        "full": tier_config.full,
    }

    for tier_name, tier in tiers.items():
        new_width = tier.width
        new_height = int(height * (new_width / width))

        resized = cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_LANCZOS4)

        output_path = output_dir / f"{image_path.stem}-{tier_name}.jpg"
        cv2.imwrite(str(output_path), resized)

        console.print(f"  {tier_name}: {new_width}x{new_height} -> {output_path.name}")

    console.print(f"[green]Output saved to:[/] {output_dir}")


@main.command("preview-export")
@click.argument(
    "image_path",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
)
@click.option(
    "--output-dir",
    "-o",
    type=click.Path(file_okay=False, path_type=Path),
    default=None,
    help="Output directory (default: same as input)",
)
@click.option(
    "--webp-quality",
    type=int,
    default=80,
    help="WebP quality (0-100, default: 80)",
)
def preview_export(image_path: Path, output_dir: Path | None, webp_quality: int) -> None:
    """Preview WebP export on a single image.

    Creates output file: {name}.webp

    \b
    Examples:
      race-processor preview-export image.jpg
      race-processor preview-export image.jpg --webp-quality 70
    """
    console.print(f"[bold]Preview export for:[/] {image_path}")

    from PIL import Image

    # Default output directory
    if output_dir is None:
        output_dir = image_path.parent

    output_dir.mkdir(parents=True, exist_ok=True)

    # Load image
    try:
        img = Image.open(image_path)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
    except Exception as e:
        console.print(f"[red]Error loading image: {e}[/]")
        return

    console.print(f"  Original size: {img.width}x{img.height}")
    original_size = image_path.stat().st_size

    # Export WebP
    webp_path = output_dir / f"{image_path.stem}.webp"
    img.save(webp_path, format="WEBP", quality=webp_quality)
    webp_size = webp_path.stat().st_size

    # Print results
    def fmt_size(b: int) -> str:
        if b >= 1024 * 1024:
            return f"{b / (1024*1024):.1f} MB"
        return f"{b / 1024:.1f} KB"

    console.print(f"  Original: {fmt_size(original_size)}")
    console.print(f"  WebP (q={webp_quality}): {fmt_size(webp_size)} ({100*webp_size//original_size}%) -> {webp_path.name}")

    console.print(f"[green]Output saved to:[/] {output_dir}")


@main.command("override-gps")
@click.argument(
    "manifest_path",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
)
@click.argument(
    "gpx_path",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
)
@click.option(
    "--offset",
    type=float,
    default=0.0,
    help="Time offset in seconds between GPX start and first photo. Positive if camera started after GPX (default: 0)",
)
@click.option(
    "--output",
    "-o",
    type=click.Path(dir_okay=False, path_type=Path),
    default=None,
    help="Output path for updated manifest (default: overwrites input)",
)
@click.option(
    "--max-time-diff",
    type=float,
    default=60.0,
    help="Maximum time difference in seconds before warning (default: 60)",
)
@click.option(
    "--debug",
    is_flag=True,
    help="Enable detailed debug logging",
)
def override_gps(
    manifest_path: Path,
    gpx_path: Path,
    offset: float,
    output: Path | None,
    max_time_diff: float,
    debug: bool,
) -> None:
    """Override image GPS data using GPX track data.

    This utility correlates images with GPX track points using relative time:
    - First photo is assumed to correspond to first GPX point
    - Subsequent photos are matched based on elapsed time
    - Override latitude, longitude, altitude from GPX
    - Calculate heading direction (bearing to next track point)

    \b
    Offset Explanation:
    - offset = 0: First photo taken at same time as GPX recording started
    - offset = +2: Camera started 2 seconds AFTER GPX (you pressed watch, waited, then camera)
    - offset = -2: Camera started 2 seconds BEFORE GPX

    \b
    Examples:
      # Basic usage (first photo = first GPX point)
      race-processor override-gps ./output/intake/metadata.json ./track.gpx

      # Camera started 2 seconds after GPX recording
      race-processor override-gps ./metadata.json ./track.gpx --offset 2

      # Debug mode to see detailed matching info
      race-processor override-gps ./metadata.json ./track.gpx --debug

      # Save to different file instead of overwriting
      race-processor override-gps ./metadata.json ./track.gpx -o ./metadata-updated.json
    """
    from .utils.gpx_override import override_gps_from_gpx, save_manifest

    # Run the GPS override
    updated_manifest = override_gps_from_gpx(
        manifest_path=manifest_path,
        gpx_path=gpx_path,
        offset_seconds=offset,
        debug=debug,
        max_time_diff_seconds=max_time_diff,
    )

    # Determine output path
    output_path = output if output else manifest_path

    # Save the updated manifest
    save_manifest(updated_manifest, output_path)


@main.command("process-gpx")
@click.argument(
    "gpx_path",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
)
@click.option(
    "--output",
    "-o",
    type=click.Path(dir_okay=False, path_type=Path),
    default=None,
    help="Output JSON path (default: {input}-processed.json)",
)
@click.option(
    "--points",
    "-n",
    type=int,
    default=200,
    help="Target number of points for polyline (default: 200)",
)
@click.option(
    "--elevation-samples",
    type=int,
    default=100,
    help="Number of samples for elevation profile (default: 100)",
)
@click.option(
    "--method",
    type=click.Choice(["uniform", "rdp"]),
    default="uniform",
    help="Simplification method: uniform (distance-based) or rdp (shape-based)",
)
@click.option(
    "--debug",
    is_flag=True,
    help="Enable debug output",
)
def process_gpx_cmd(
    gpx_path: Path,
    output: Path | None,
    points: int,
    elevation_samples: int,
    method: str,
    debug: bool,
) -> None:
    """Process GPX file into simplified data for web display.

    Creates JSON output containing:
    - Simplified polyline (for minimap)
    - Geographic bounds
    - Elevation profile (for chart)
    - Distance and elevation statistics

    \b
    Examples:
      # Basic usage (creates track-processed.json)
      race-processor process-gpx track.gpx

      # Custom output and 300 points
      race-processor process-gpx track.gpx -o route.json --points 300

      # Use RDP algorithm (preserves shape better for curvy routes)
      race-processor process-gpx track.gpx --method rdp
    """
    from .utils.gpx_process import process_gpx, save_processed_gpx

    # Default output path
    if output is None:
        output = gpx_path.parent / f"{gpx_path.stem}-processed.json"

    # Process GPX
    result = process_gpx(
        gpx_path=gpx_path,
        target_points=points,
        elevation_samples=elevation_samples,
        simplification_method=method,
        debug=debug,
    )

    if result:
        save_processed_gpx(result, output)


@main.command("check-exif")
@click.argument(
    "path",
    type=click.Path(exists=True, path_type=Path),
)
def check_exif(path: Path) -> None:
    """Check EXIF data in an image or directory of images.

    Reports any GPS/location data found - useful for verifying
    privacy before upload.

    \b
    Examples:
      race-processor check-exif image.jpg
      race-processor check-exif ./output/final/
    """
    console.print(f"[bold]Checking EXIF data in:[/] {path}")

    import exifread

    if path.is_file():
        files = [path]
    else:
        extensions = {".jpg", ".jpeg", ".png", ".webp"}
        files = [f for f in path.rglob("*") if f.suffix.lower() in extensions]

    console.print(f"  Scanning {len(files)} files...")

    files_with_gps = 0
    for file_path in files:
        try:
            with open(file_path, "rb") as f:
                tags = exifread.process_file(f, details=False)

            gps_tags = [k for k in tags.keys() if k.startswith("GPS")]
            if gps_tags:
                files_with_gps += 1
                console.print(f"\n  [yellow]{file_path.name}[/]")
                for tag in gps_tags[:5]:
                    console.print(f"    {tag}: {tags[tag]}")
                if len(gps_tags) > 5:
                    console.print(f"    ... and {len(gps_tags) - 5} more GPS tags")
        except Exception as e:
            console.print(f"  [dim]Could not read {file_path.name}: {e}[/]")

    console.print()
    if files_with_gps:
        console.print(f"[red]Found GPS data in {files_with_gps} of {len(files)} files[/]")
    else:
        console.print(f"[green]No GPS data found in {len(files)} files[/]")


@main.group()
def db() -> None:
    """Database management commands."""
    pass


@db.command("init")
@click.option(
    "--schema",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
    default=None,
    help="Path to schema.sql (default: db/schema.sql)",
)
def db_init(schema: Path | None) -> None:
    """Initialize database schema.

    \b
    Examples:
      race-processor db init
      race-processor db init --schema ./custom-schema.sql
    """
    from .utils.db import init_schema

    success = init_schema(schema)
    if not success:
        raise SystemExit(1)


@db.command("insert")
@click.argument(
    "config_path",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
)
@click.option(
    "--update",
    "update_if_exists",
    is_flag=True,
    help="Update race if it already exists",
)
def db_insert(config_path: Path, update_if_exists: bool) -> None:
    """Insert a race from config file (YAML or JSON).

    \b
    Config file should contain race fields:
      slug: hk-marathon-2026
      name: Hong Kong Marathon 2026
      distance_meters: 42195
      capture_date: 2026-01-15
      storage_bucket: my-bucket
      storage_prefix: races/hk-marathon-2026/
      ...

    \b
    Examples:
      race-processor db insert race-config.yaml
      race-processor db insert race.json --update
    """
    from .utils.db import load_race_config, insert_race

    console.print(f"[bold]Loading config:[/] {config_path}")

    config = load_race_config(config_path)
    race_id = insert_race(config, update_if_exists)

    if not race_id:
        raise SystemExit(1)


@db.command("insert-images")
@click.argument("slug_or_id")
@click.argument(
    "records_path",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
)
def db_insert_images(slug_or_id: str, records_path: Path) -> None:
    """Insert images from db_records.json for a race.

    \b
    Examples:
      race-processor db insert-images hk-marathon-2026 ./output/db_records.json
    """
    from .utils.db import get_race, insert_images
    import json

    race = get_race(slug_or_id)
    if not race:
        console.print(f"[red]Race not found:[/] {slug_or_id}")
        raise SystemExit(1)

    with open(records_path) as f:
        records = json.load(f)

    success = insert_images(race["id"], records)
    if not success:
        raise SystemExit(1)


@db.command("list")
@click.option(
    "--status",
    type=click.Choice(["pending", "processing", "ready", "error"]),
    default=None,
    help="Filter by status",
)
@click.option(
    "--json",
    "as_json",
    is_flag=True,
    help="Output as JSON",
)
def db_list(status: str | None, as_json: bool) -> None:
    """List all races.

    \b
    Examples:
      race-processor db list
      race-processor db list --status ready
      race-processor db list --json
    """
    from .utils.db import list_races, print_races_table
    import json as json_lib

    races = list_races(status)

    if as_json:
        console.print(json_lib.dumps(races, indent=2))
    else:
        print_races_table(races)


@db.command("get")
@click.argument("slug_or_id")
@click.option(
    "--json",
    "as_json",
    is_flag=True,
    help="Output as JSON",
)
def db_get(slug_or_id: str, as_json: bool) -> None:
    """Get race details by slug or ID.

    \b
    Examples:
      race-processor db get hk-marathon-2026
      race-processor db get 123e4567-e89b-12d3-a456-426614174000 --json
    """
    from .utils.db import get_race, print_race_details
    import json as json_lib

    race = get_race(slug_or_id)

    if not race:
        console.print(f"[red]Race not found:[/] {slug_or_id}")
        raise SystemExit(1)

    if as_json:
        console.print(json_lib.dumps(race, indent=2, default=str))
    else:
        print_race_details(race)


@db.command("update")
@click.argument("slug_or_id")
@click.argument(
    "config_path",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
)
def db_update(slug_or_id: str, config_path: Path) -> None:
    """Update race from config file.

    \b
    Examples:
      race-processor db update hk-marathon-2026 updated-config.yaml
    """
    from .utils.db import load_race_config, get_race, get_connection
    import json as json_lib
    from datetime import datetime, date as date_type

    race = get_race(slug_or_id)
    if not race:
        console.print(f"[red]Race not found:[/] {slug_or_id}")
        raise SystemExit(1)

    console.print(f"[bold]Updating race:[/] {race['slug']}")

    config = load_race_config(config_path)

    # Build update query
    fields = [
        "name", "description", "flag_emoji", "recorded_year", "recorded_by",
        "distance_meters", "race_date", "city", "country", "elevation_gain",
        "elevation_loss", "elevation_bars", "minimap_url", "card_image_url",
        "tier", "total_images", "capture_date", "capture_device", "status",
        "is_testing", "storage_bucket", "storage_prefix"
    ]

    update_parts = []
    update_values = []

    for field in fields:
        if field in config:
            update_parts.append(f"{field} = %s")
            value = config[field]

            if field == "elevation_bars" and isinstance(value, list):
                value = json_lib.dumps(value)
            elif field in ("race_date", "capture_date") and isinstance(value, str):
                value = datetime.fromisoformat(value).date() if "T" in value else date_type.fromisoformat(value)

            update_values.append(value)

    if not update_parts:
        console.print("[yellow]No fields to update in config[/]")
        return

    update_values.append(race["id"])

    conn = get_connection()
    cur = conn.cursor()

    try:
        query = f"UPDATE races SET {', '.join(update_parts)} WHERE id = %s"
        cur.execute(query, update_values)
        conn.commit()
        console.print(f"[green]Race updated:[/] {race['slug']}")
    except Exception as e:
        conn.rollback()
        console.print(f"[red]Failed to update:[/] {e}")
        raise SystemExit(1)
    finally:
        cur.close()
        conn.close()


@db.command("update-gpx")
@click.argument("slug_or_id")
@click.argument(
    "gpx_path",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
)
@click.option(
    "--smoothing",
    type=float,
    default=1.0,
    help="Elevation smoothing threshold in meters (default: 1.0). Higher values filter more noise.",
)
def db_update_gpx(slug_or_id: str, gpx_path: Path, smoothing: float) -> None:
    """Update race distance and elevation stats from GPX file.

    Extracts the following from the GPX track:
    - distance_meters: Total track distance
    - elevation_gain: Total elevation gain
    - elevation_loss: Total elevation loss
    - elevation_min: Lowest point elevation
    - elevation_max: Highest point elevation

    \b
    Examples:
      race-processor db update-gpx test-route-01 ./track.gpx
      race-processor db update-gpx test-route-01 ./track.gpx --smoothing 3.0
    """
    from .utils.db import get_race, update_race_gpx_stats
    from .utils.gpx_process import extract_gpx_race_stats

    race = get_race(slug_or_id)
    if not race:
        console.print(f"[red]Race not found:[/] {slug_or_id}")
        raise SystemExit(1)

    console.print(f"[bold]Updating race from GPX:[/] {race['slug']}")
    console.print(f"  GPX file: {gpx_path}")
    console.print(f"  Smoothing threshold: {smoothing} m")

    # Extract stats from GPX
    stats = extract_gpx_race_stats(gpx_path, elevation_threshold=smoothing)
    if not stats:
        console.print("[red]Failed to extract stats from GPX file[/]")
        raise SystemExit(1)

    console.print(f"  Extracted stats:")
    console.print(f"    Distance: {stats['distance_meters']:,} m ({stats['distance_meters']/1000:.2f} km)")
    console.print(f"    Elevation gain: {stats['elevation_gain']:,} m")
    console.print(f"    Elevation loss: {stats['elevation_loss']:,} m")
    console.print(f"    Elevation range: {stats['elevation_min']:,} m to {stats['elevation_max']:,} m")
    console.print(f"    Elevation bars: {len(stats.get('elevation_bars', []))} samples")

    # Update the race
    success = update_race_gpx_stats(
        slug_or_id=race["id"],
        distance_meters=stats["distance_meters"],
        elevation_gain=stats["elevation_gain"],
        elevation_loss=stats["elevation_loss"],
        elevation_min=stats["elevation_min"],
        elevation_max=stats["elevation_max"],
        elevation_bars=stats.get("elevation_bars"),
    )

    if not success:
        raise SystemExit(1)


@main.command("gpx-stats")
@click.argument(
    "gpx_path",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
)
@click.option(
    "--smoothing",
    type=float,
    default=1.0,
    help="Elevation smoothing threshold in meters (default: 1.0). Higher values filter more noise.",
)
def gpx_stats(gpx_path: Path, smoothing: float) -> None:
    """Preview GPX file statistics without updating database.

    Shows distance, elevation gain/loss, and elevation range.
    Use --smoothing to adjust how much GPS noise is filtered.

    \b
    Examples:
      race-processor gpx-stats ./track.gpx
      race-processor gpx-stats ./track.gpx --smoothing 0.5
      race-processor gpx-stats ./track.gpx --smoothing 3.0
    """
    from .utils.gpx_process import extract_gpx_race_stats

    console.print(f"[bold]GPX Stats Preview[/]")
    console.print(f"  File: {gpx_path}")
    console.print(f"  Smoothing threshold: {smoothing} m")
    console.print()

    stats = extract_gpx_race_stats(gpx_path, elevation_threshold=smoothing)
    if not stats:
        console.print("[red]Failed to extract stats from GPX file[/]")
        raise SystemExit(1)

    console.print(f"  [cyan]Distance:[/]        {stats['distance_meters']:,} m ({stats['distance_meters']/1000:.2f} km)")
    console.print(f"  [cyan]Elevation gain:[/]  +{stats['elevation_gain']:,} m")
    console.print(f"  [cyan]Elevation loss:[/]  -{stats['elevation_loss']:,} m")
    console.print(f"  [cyan]Elevation min:[/]   {stats['elevation_min']:,} m")
    console.print(f"  [cyan]Elevation max:[/]   {stats['elevation_max']:,} m")
    console.print(f"  [cyan]Elevation bars:[/]  {len(stats.get('elevation_bars', []))} samples")


@db.command("delete")
@click.argument("slug_or_id")
@click.option(
    "--yes",
    "-y",
    is_flag=True,
    help="Skip confirmation prompt",
)
def db_delete(slug_or_id: str, yes: bool) -> None:
    """Delete a race by slug or ID.

    \b
    Examples:
      race-processor db delete hk-marathon-2026
      race-processor db delete hk-marathon-2026 --yes
    """
    from .utils.db import get_race, delete_race

    race = get_race(slug_or_id)
    if not race:
        console.print(f"[red]Race not found:[/] {slug_or_id}")
        raise SystemExit(1)

    if not yes:
        console.print(f"[yellow]This will delete race:[/] {race['name']} ({race['slug']})")
        console.print("[yellow]This will also delete all associated images and data.[/]")
        confirm = click.confirm("Are you sure?")
        if not confirm:
            console.print("Aborted.")
            return

    success = delete_race(slug_or_id)
    if not success:
        raise SystemExit(1)


@main.group()
def r2() -> None:
    """R2 storage management commands."""
    pass


@r2.command("delete")
@click.argument("race_slug")
@click.option(
    "--yes",
    "-y",
    is_flag=True,
    help="Skip confirmation prompt",
)
@click.option(
    "--prefix",
    type=str,
    default=None,
    help="Override storage prefix (default: races/{race_slug})",
)
def r2_delete(race_slug: str, yes: bool, prefix: str | None) -> None:
    """Delete all images for a race from R2.

    \b
    Examples:
      race-processor r2 delete hk-marathon-2026
      race-processor r2 delete hk-marathon-2026 --yes
    """
    from .pipeline.upload import delete_from_r2

    r2_config = load_r2_config()
    if not r2_config:
        console.print("[red]Error: R2 credentials not found in environment or .env.local[/]")
        raise SystemExit(1)

    storage_prefix = prefix if prefix else f"races/{race_slug}"

    if not yes:
        console.print(f"[yellow]This will delete all objects in R2 under:[/] {storage_prefix}")
        confirm = click.confirm("Are you sure?")
        if not confirm:
            console.print("Aborted.")
            return

    success = delete_from_r2(r2_config, storage_prefix)
    if not success:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

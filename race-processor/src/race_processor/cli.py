"""
Command-line interface for the race processor pipeline.
"""

import click
from pathlib import Path
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

from .config import (
    PipelineConfig,
    DEFAULT_OUTPUT_DIR,
    DebugConfig,
    StepControlConfig,
    CopyrightConfig,
)

console = Console()


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
    "--skip-upload",
    is_flag=True,
    help="Skip R2 upload stage",
)
@click.option(
    "--blur-mode",
    type=click.Choice(["full", "demo", "skip"]),
    default="demo",
    help="Blur detection mode: full (requires models), demo (fake detections), skip (no blur)",
)
@click.option(
    "--conf",
    type=float,
    default=0.25,
    help="Confidence threshold for blur detection (default: 0.25)",
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
def process(
    input_dir: Path | None,
    race_slug: str | None,
    output_dir: Path,
    src: Path | None,
    dst: Path | None,
    workers: int,
    skip_blur: bool,
    skip_upload: bool,
    blur_mode: str,
    conf: float,
    debug: bool,
    debug_format: str,
    start_step: int,
    end_step: int,
    step: int | None,
    single_image: str | None,
    copyright_text: str | None,
) -> None:
    """Process equirectangular images through the pipeline.

    \b
    Pipeline Steps:
      1. Intake    - Import images, extract EXIF, sort by timestamp, rename sequentially
      2. Blur      - Apply privacy blurring (faces, plates)
      3. Watermark - Add copyright text overlay
      4. Resize    - Generate quality tiers (thumbnail, medium, full)
      5. Export    - Encode to AVIF/WebP formats
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
      --blur-mode full   Use YOLO models (requires download-models)
      --blur-mode demo   Generate fake detections for testing (default)
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

    config = PipelineConfig(
        input_dir=input_dir,
        output_dir=output_dir,
        race_slug=race_slug,
        workers=workers,
        skip_blur=skip_blur,
        skip_upload=skip_upload,
        debug=debug_config,
        step_control=step_control,
        copyright=copyright_config,
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
    default="preview",
    help="Race slug for the manifest",
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


@main.command("download-models")
def download_models() -> None:
    """Download required YOLO model weights."""
    console.print("[bold]Downloading YOLO models...[/]")

    from .config import DEFAULT_MODELS_DIR

    DEFAULT_MODELS_DIR.mkdir(parents=True, exist_ok=True)

    models = [
        "yolov8n.pt",
        "yolov8n-pose.pt",
    ]

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        for model in models:
            task = progress.add_task(f"Downloading {model}...", total=None)
            # Ultralytics auto-downloads models on first use
            from ultralytics import YOLO

            _ = YOLO(model)
            progress.update(task, completed=True)

    console.print("[green]Models downloaded successfully![/]")
    console.print(f"  Location: {DEFAULT_MODELS_DIR}")
    console.print()
    console.print("[yellow]Note:[/] Face detection models (yolov8n-face, yolov8m-face)")
    console.print("      must be downloaded separately from:")
    console.print("      https://github.com/akanametov/yolov8-face")


@main.command("preview-blur")
@click.argument(
    "image_path",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
)
@click.option(
    "--output",
    "-o",
    type=click.Path(dir_okay=False, path_type=Path),
    default="blur-preview.jpg",
    help="Output preview image",
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
    "--mode",
    type=click.Choice(["full", "demo"]),
    default="full",
    help="Detection mode (default: full)",
)
@click.option(
    "--conf",
    type=float,
    default=0.25,
    help="Confidence threshold for detections (default: 0.25)",
)
def preview_blur(image_path: Path, output: Path, show_sources: bool, blur: bool, mode: str, conf: float) -> None:
    """Preview blur detection or the actual blurring effect."""
    console.print(f"[bold]Preview blur {'effect' if blur else 'detection'} for:[/] {image_path}")

    from .detection.ensemble import PrivacyBlurEnsemble, blur_image
    from .config import DEFAULT_MODELS_DIR, BlurConfig
    import cv2

    # Load image
    image = cv2.imread(str(image_path))
    if image is None:
        console.print("[red]Error: Could not load image[/]")
        return

    # Run detection
    ensemble = PrivacyBlurEnsemble(mode=mode, models_dir=DEFAULT_MODELS_DIR, conf_threshold=conf)
    regions = ensemble.detect_all(image)

    console.print(f"  Detected {len(regions)} regions (threshold: {conf})")

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


@main.command("check-exif")
@click.argument(
    "path",
    type=click.Path(exists=True, path_type=Path),
)
def check_exif(path: Path) -> None:
    """Check EXIF data in an image or directory of images.

    Reports any GPS/location data found - useful for verifying
    privacy before upload.
    """
    console.print(f"[bold]Checking EXIF data in:[/] {path}")

    import exifread

    if path.is_file():
        files = [path]
    else:
        extensions = {".jpg", ".jpeg", ".png", ".avif", ".webp"}
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


if __name__ == "__main__":
    main()

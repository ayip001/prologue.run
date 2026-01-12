"""
Command-line interface for the race processor pipeline.
"""

import click
from pathlib import Path
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

from .config import PipelineConfig, DEFAULT_OUTPUT_DIR

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
    required=True,
    help="Input directory containing race data (insp/ and gpx/ subdirs)",
)
@click.option(
    "--race-slug",
    "-r",
    required=True,
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
    "--workers",
    "-w",
    default=4,
    help="Number of parallel workers",
)
@click.option(
    "--use-sdk/--use-cli",
    default=True,
    help="Use Insta360 SDK (default) or Studio CLI",
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
def process(
    input_dir: Path,
    race_slug: str,
    output_dir: Path,
    workers: int,
    use_sdk: bool,
    skip_blur: bool,
    skip_upload: bool,
) -> None:
    """Process a race from raw .insp files to final output."""
    console.print(f"[bold green]Processing race:[/] {race_slug}")
    console.print(f"  Input: {input_dir}")
    console.print(f"  Output: {output_dir}")
    console.print(f"  Workers: {workers}")

    config = PipelineConfig(
        input_dir=input_dir,
        output_dir=output_dir,
        race_slug=race_slug,
        use_sdk=use_sdk,
        workers=workers,
        skip_blur=skip_blur,
        skip_upload=skip_upload,
    )

    # Import and run orchestrator
    from .pipeline.orchestrator import run_pipeline

    run_pipeline(config)


@main.command()
@click.argument(
    "input_dir",
    type=click.Path(exists=True, file_okay=False, path_type=Path),
)
@click.option(
    "--gpx",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
    help="GPX file to associate with the race",
)
@click.option(
    "--output",
    "-o",
    type=click.Path(dir_okay=False, path_type=Path),
    default="manifest.json",
    help="Output manifest file",
)
def ingest(input_dir: Path, gpx: Path | None, output: Path) -> None:
    """Discover .insp files and create processing manifest."""
    console.print(f"[bold]Ingesting files from:[/] {input_dir}")

    from .pipeline.ingest import discover_and_create_manifest

    manifest = discover_and_create_manifest(input_dir, gpx)

    console.print(f"  Found {len(manifest.sources)} images")
    console.print(f"  Total distance: {manifest.total_distance}m")

    # Save manifest
    import json

    with open(output, "w") as f:
        json.dump(manifest.model_dump(), f, indent=2, default=str)

    console.print(f"[green]Manifest saved to:[/] {output}")


@main.command()
@click.argument(
    "input_dir",
    type=click.Path(exists=True, file_okay=False, path_type=Path),
)
def validate(input_dir: Path) -> None:
    """Validate .insp file naming and count."""
    console.print(f"[bold]Validating files in:[/] {input_dir}")

    from .insta360.filename import discover_insp_files

    insp_dir = input_dir / "insp" if (input_dir / "insp").exists() else input_dir
    files = discover_insp_files(insp_dir)

    console.print(f"  Found {len(files)} valid .insp files")

    if files:
        first = files[0]
        last = files[-1]
        duration = last.captured_at - first.captured_at
        console.print(f"  Time span: {duration}")
        console.print(f"  First: {first.path.name} ({first.captured_at})")
        console.print(f"  Last: {last.path.name} ({last.captured_at})")


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
def preview_blur(image_path: Path, output: Path, show_sources: bool) -> None:
    """Preview blur detection without applying blur."""
    console.print(f"[bold]Preview blur detection for:[/] {image_path}")

    from .detection.ensemble import PrivacyBlurEnsemble
    import cv2

    # Load image
    image = cv2.imread(str(image_path))
    if image is None:
        console.print("[red]Error: Could not load image[/]")
        return

    # Run detection
    ensemble = PrivacyBlurEnsemble()
    regions = ensemble.detect_all(image)

    console.print(f"  Detected {len(regions)} regions to blur")

    # Draw bounding boxes
    for region in regions:
        x1 = region.x - region.width // 2
        y1 = region.y - region.height // 2
        x2 = region.x + region.width // 2
        y2 = region.y + region.height // 2

        # Color by source if requested
        if show_sources:
            colors = {
                "face_yolo_n": (0, 255, 0),
                "face_yolo_m": (0, 200, 0),
                "body_pose_head": (255, 0, 0),
                "plate": (0, 0, 255),
            }
            color = colors.get(region.source.value, (255, 255, 255))
        else:
            color = (0, 255, 0)

        cv2.rectangle(image, (x1, y1), (x2, y2), color, 2)
        label = f"{region.source.value}: {region.confidence:.2f}"
        cv2.putText(image, label, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)

    # Save preview
    cv2.imwrite(str(output), image)
    console.print(f"[green]Preview saved to:[/] {output}")


@main.command("generate-card-assets")
@click.option(
    "--gpx",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
    required=True,
    help="GPX file with route data",
)
@click.option(
    "--output",
    "-o",
    type=click.Path(file_okay=False, path_type=Path),
    required=True,
    help="Output directory for card assets",
)
@click.option(
    "--race-slug",
    "-r",
    required=True,
    help="Race slug for naming",
)
def generate_card_assets(gpx: Path, output: Path, race_slug: str) -> None:
    """Generate landing page card assets from GPX data."""
    console.print(f"[bold]Generating card assets for:[/] {race_slug}")

    from .pipeline.card_assets import generate_all_card_assets

    output.mkdir(parents=True, exist_ok=True)
    generate_all_card_assets(gpx, output, race_slug)

    console.print(f"[green]Card assets saved to:[/] {output}")


if __name__ == "__main__":
    main()

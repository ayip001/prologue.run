"""
Main pipeline orchestrator that coordinates all processing stages.
"""

from pathlib import Path
from rich.console import Console
from rich.progress import Progress, TaskID

from ..config import PipelineConfig
from .ingest import discover_and_create_manifest

console = Console()


def run_pipeline(config: PipelineConfig) -> None:
    """
    Run the complete processing pipeline.

    Stages:
    1. Ingest - Discover files and create manifest
    2. Stabilize - Extract gyro data and calculate corrections
    3. Stitch - Convert to equirectangular with stabilization
    4. Blur - Apply privacy blurring
    5. Resize - Generate quality tiers
    6. Export - Encode to AVIF/WebP
    7. Upload - Upload to R2 (optional)
    """
    console.print("[bold blue]Starting pipeline...[/]")

    # Create output directories
    output_base = config.output_dir / config.race_slug
    output_base.mkdir(parents=True, exist_ok=True)

    dirs = {
        "equirect": output_base / "equirect",
        "blurred": output_base / "blurred",
        "resized": output_base / "resized",
        "final": output_base / "final",
    }
    for d in dirs.values():
        d.mkdir(exist_ok=True)

    # Stage 1: Ingest
    console.print("\n[bold]Stage 1: Ingest[/]")
    gpx_dir = config.input_dir / "gpx"
    gpx_files = list(gpx_dir.glob("*.gpx")) if gpx_dir.exists() else []
    gpx_file = gpx_files[0] if gpx_files else None

    manifest = discover_and_create_manifest(
        config.input_dir,
        gpx_file=gpx_file,
        race_slug=config.race_slug,
    )
    console.print(f"  Found {len(manifest.sources)} images")
    console.print(f"  Total distance: {manifest.total_distance}m")

    # Stage 2-3: Stabilize & Stitch
    console.print("\n[bold]Stage 2-3: Stabilize & Stitch[/]")
    console.print("  [yellow]Skipping - Insta360 SDK integration required[/]")
    console.print("  Place equirectangular images in: {dirs['equirect']}")

    # Stage 4: Blur
    if not config.skip_blur:
        console.print("\n[bold]Stage 4: Blur[/]")
        console.print("  [yellow]Skipping - YOLO models required[/]")
        console.print("  Run: race-processor download-models")

    # Stage 5: Resize
    console.print("\n[bold]Stage 5: Resize[/]")
    console.print("  [yellow]Skipping - No source images[/]")

    # Stage 6: Export
    console.print("\n[bold]Stage 6: Export[/]")
    console.print("  [yellow]Skipping - No source images[/]")

    # Stage 7: Upload
    if not config.skip_upload:
        console.print("\n[bold]Stage 7: Upload[/]")
        if config.r2:
            console.print("  [yellow]Skipping - No files to upload[/]")
        else:
            console.print("  [yellow]Skipping - R2 config not provided[/]")

    console.print("\n[bold green]Pipeline complete![/]")
    console.print(f"  Output: {output_base}")

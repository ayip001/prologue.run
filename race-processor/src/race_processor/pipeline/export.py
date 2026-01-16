"""
Step 5: Export - Encode resized images to WebP format.

This step takes the resized image tiers and encodes them to WebP.
"""

from pathlib import Path
from typing import Optional

from PIL import Image
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn

from ..config import ImageTiersConfig

console = Console()


def encode_image(
    source_path: Path,
    webp_path: Path,
    webp_quality: int,
) -> Optional[int]:
    """
    Encode a single image to WebP format.

    Args:
        source_path: Path to source image (JPG/PNG)
        webp_path: Output path for WebP
        webp_quality: WebP quality (0-100)

    Returns:
        WebP size in bytes, or None if encoding failed
    """
    try:
        with Image.open(source_path) as img:
            # Convert to RGB if necessary
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")

            # Save WebP
            img.save(webp_path, format="WEBP", quality=webp_quality)
            webp_size = webp_path.stat().st_size

            return webp_size

    except Exception as e:
        console.print(f"  [red]Error encoding {source_path.name}: {e}[/]")
        return None


def run_export(
    input_dir: Path,
    output_dir: Path,
    tier_config: Optional[ImageTiersConfig] = None,
) -> dict[str, list[Path]]:
    """
    Export all resized images to WebP format.

    Args:
        input_dir: Directory containing resized/ subdirectory with tier folders
        output_dir: Directory to write final/ output
        tier_config: Image tier configuration (for quality settings)

    Returns:
        Dict mapping tier names to lists of output paths
    """
    if tier_config is None:
        tier_config = ImageTiersConfig()

    # Setup directories
    resized_dir = input_dir / "resized"
    final_dir = output_dir / "final"

    tiers = {
        "thumbnail": ("thumb", tier_config.thumbnail),
        "medium": ("medium", tier_config.medium),
        "full": ("full", tier_config.full),
    }

    output_paths: dict[str, list[Path]] = {
        "thumb": [],
        "medium": [],
        "full": [],
    }

    total_webp_size = 0
    total_source_size = 0

    for tier_name, (output_name, tier_cfg) in tiers.items():
        source_tier_dir = resized_dir / tier_name
        if not source_tier_dir.exists():
            console.print(f"  [yellow]Skipping {tier_name}: directory not found[/]")
            continue

        # Create output directory
        webp_dir = final_dir / output_name
        webp_dir.mkdir(parents=True, exist_ok=True)

        # Get source images
        source_images = sorted(
            f for f in source_tier_dir.iterdir()
            if f.suffix.lower() in {".jpg", ".jpeg", ".png"}
        )

        if not source_images:
            console.print(f"  [yellow]No images found in {tier_name}/[/]")
            continue

        console.print(f"  Encoding {tier_name}: {len(source_images)} images...")

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TextColumn("{task.completed}/{task.total}"),
            console=console,
            transient=True,
        ) as progress:
            task = progress.add_task(f"  {tier_name}", total=len(source_images))

            for source_path in source_images:
                # Generate output filename (change extension)
                base_name = source_path.stem
                webp_path = webp_dir / f"{base_name}.webp"

                # Track source size
                total_source_size += source_path.stat().st_size

                # Encode
                webp_size = encode_image(
                    source_path,
                    webp_path,
                    webp_quality=tier_cfg.webp_quality,
                )

                if webp_size:
                    output_paths[output_name].append(webp_path)
                    total_webp_size += webp_size

                progress.advance(task)

    # Print summary
    def format_size(size_bytes: int) -> str:
        if size_bytes >= 1024 * 1024:
            return f"{size_bytes / (1024 * 1024):.1f} MB"
        elif size_bytes >= 1024:
            return f"{size_bytes / 1024:.1f} KB"
        return f"{size_bytes} B"

    console.print(f"\n  [bold]Export Summary:[/]")
    console.print(f"    Source size:  {format_size(total_source_size)}")
    console.print(f"    WebP size:    {format_size(total_webp_size)} ({100*total_webp_size//max(total_source_size,1)}%)")

    total_files = sum(len(paths) for paths in output_paths.values())
    console.print(f"    Total files:  {total_files}")

    return output_paths

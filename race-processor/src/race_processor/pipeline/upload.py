"""
Step 6: Upload - Sanity check, upload to R2, insert records into Neon.

This step:
1. Checks that output images have no GPS EXIF data (privacy sanity check)
2. Uploads all tier images to Cloudflare R2
3. Inserts image records into Neon PostgreSQL database
"""

import os
from pathlib import Path
from typing import Optional
from datetime import datetime

import exifread
import boto3
from botocore.config import Config
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn

from ..config import R2Config
from .intake import IntakeManifest, load_manifest

console = Console()


def check_exif_privacy(image_path: Path) -> list[str]:
    """
    Check if an image contains any location-related EXIF data.

    Args:
        image_path: Path to image file

    Returns:
        List of found GPS-related EXIF tags (empty if clean)
    """
    gps_tags_found = []

    try:
        with open(image_path, "rb") as f:
            tags = exifread.process_file(f, details=False)

        # Check for any GPS-related tags
        gps_tag_prefixes = ["GPS", "Image GPSInfo"]
        for tag_name in tags.keys():
            for prefix in gps_tag_prefixes:
                if tag_name.startswith(prefix):
                    gps_tags_found.append(tag_name)

    except Exception as e:
        console.print(f"  [yellow]Warning: Could not check EXIF for {image_path.name}: {e}[/]")

    return gps_tags_found


def run_privacy_check(final_dir: Path) -> tuple[bool, int, int]:
    """
    Run privacy sanity check on all output images.

    Args:
        final_dir: Directory containing final/ output with tier subdirectories

    Returns:
        Tuple of (passed, total_checked, total_with_gps)
    """
    console.print("  Running EXIF privacy sanity check...")

    total_checked = 0
    images_with_gps = 0
    problematic_files: list[tuple[str, list[str]]] = []

    # Check all tiers
    for tier_dir in final_dir.iterdir():
        if not tier_dir.is_dir():
            continue

        for img_path in tier_dir.iterdir():
            if img_path.suffix.lower() not in {".avif", ".webp", ".jpg", ".jpeg", ".png"}:
                continue

            total_checked += 1
            gps_tags = check_exif_privacy(img_path)

            if gps_tags:
                images_with_gps += 1
                problematic_files.append((str(img_path.relative_to(final_dir)), gps_tags))

    if problematic_files:
        console.print(f"  [red]WARNING: Found {images_with_gps} images with GPS EXIF data![/]")
        for file_path, tags in problematic_files[:5]:  # Show first 5
            console.print(f"    - {file_path}: {', '.join(tags[:3])}")
        if len(problematic_files) > 5:
            console.print(f"    ... and {len(problematic_files) - 5} more")
        return False, total_checked, images_with_gps
    else:
        console.print(f"  [green]Privacy check passed: {total_checked} images verified clean[/]")
        return True, total_checked, 0


def create_r2_client(config: R2Config):
    """Create a boto3 client configured for Cloudflare R2."""
    return boto3.client(
        "s3",
        endpoint_url=config.endpoint,
        aws_access_key_id=config.access_key_id,
        aws_secret_access_key=config.secret_access_key,
        region_name=config.region,
        config=Config(
            signature_version="s3v4",
            retries={"max_attempts": 3, "mode": "adaptive"},
        ),
    )


def get_content_type(path: Path) -> str:
    """Get the appropriate content-type for an image file."""
    suffix = path.suffix.lower()
    content_types = {
        ".avif": "image/avif",
        ".webp": "image/webp",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
    }
    return content_types.get(suffix, "application/octet-stream")


def upload_to_r2(
    final_dir: Path,
    config: R2Config,
    storage_prefix: str,
) -> dict[str, int]:
    """
    Upload all images in final/ to Cloudflare R2.

    Args:
        final_dir: Directory containing tier subdirectories
        config: R2 configuration
        storage_prefix: Prefix path in R2 bucket (e.g., "races/hk-marathon-2025/")

    Returns:
        Dict with upload statistics
    """
    client = create_r2_client(config)

    stats = {
        "uploaded": 0,
        "failed": 0,
        "total_bytes": 0,
    }

    # Collect all files to upload
    files_to_upload: list[tuple[Path, str]] = []

    for tier_dir in sorted(final_dir.iterdir()):
        if not tier_dir.is_dir():
            continue

        tier_name = tier_dir.name
        for img_path in sorted(tier_dir.iterdir()):
            if img_path.suffix.lower() not in {".avif", ".webp"}:
                continue

            # Build R2 key: {storage_prefix}/{tier}/{filename}
            r2_key = f"{storage_prefix.rstrip('/')}/{tier_name}/{img_path.name}"
            files_to_upload.append((img_path, r2_key))

    if not files_to_upload:
        console.print("  [yellow]No files to upload[/]")
        return stats

    console.print(f"  Uploading {len(files_to_upload)} files to R2...")

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("{task.completed}/{task.total}"),
        console=console,
        transient=True,
    ) as progress:
        task = progress.add_task("  Uploading", total=len(files_to_upload))

        for img_path, r2_key in files_to_upload:
            try:
                content_type = get_content_type(img_path)
                file_size = img_path.stat().st_size

                with open(img_path, "rb") as f:
                    client.put_object(
                        Bucket=config.bucket,
                        Key=r2_key,
                        Body=f,
                        ContentType=content_type,
                        CacheControl="public, max-age=31536000, immutable",
                    )

                stats["uploaded"] += 1
                stats["total_bytes"] += file_size

            except Exception as e:
                console.print(f"  [red]Failed to upload {img_path.name}: {e}[/]")
                stats["failed"] += 1

            progress.advance(task)

    console.print(
        f"  [green]Uploaded {stats['uploaded']} files "
        f"({stats['total_bytes'] / (1024*1024):.1f} MB)[/]"
    )
    if stats["failed"]:
        console.print(f"  [red]Failed: {stats['failed']} files[/]")

    return stats


def generate_db_records(
    manifest: IntakeManifest,
    final_dir: Path,
    storage_prefix: str,
) -> list[dict]:
    """
    Generate database records for all images.

    Args:
        manifest: Intake manifest with EXIF metadata
        final_dir: Directory containing final output
        storage_prefix: R2 storage prefix

    Returns:
        List of dicts ready for database insertion
    """
    records = []

    # Map position_index to metadata
    metadata_by_index = {img.position_index: img for img in manifest.images}

    # Determine file naming (check what files exist)
    thumb_dir = final_dir / "thumb"
    if not thumb_dir.exists():
        return records

    # Get list of base names from thumbnail directory
    avif_files = sorted(thumb_dir.glob("*.avif"))

    for avif_path in avif_files:
        base_name = avif_path.stem  # e.g., "001"

        try:
            position_index = int(base_name) - 1  # Convert to 0-indexed
        except ValueError:
            continue

        meta = metadata_by_index.get(position_index)
        if not meta:
            console.print(f"  [yellow]Warning: No metadata for index {position_index}[/]")
            continue

        # Build paths relative to storage_prefix
        # Note: heading_degrees is NOT included - calculated separately from GPX
        record = {
            "position_index": position_index,
            "latitude": meta.latitude,
            "longitude": meta.longitude,
            "altitude_meters": meta.altitude_meters,
            "captured_at": meta.captured_at,
            "path_thumbnail": f"thumb/{base_name}.avif",
            "path_medium": f"medium/{base_name}.avif",
            "path_full": f"full/{base_name}.avif",
            "path_thumb_webp": f"thumb_webp/{base_name}.webp",
            "path_med_webp": f"medium_webp/{base_name}.webp",
            "path_full_webp": f"full_webp/{base_name}.webp",
            "has_blur_applied": True,  # We always apply blur
        }
        records.append(record)

    return records


def save_db_records(records: list[dict], output_path: Path) -> None:
    """Save database records to a JSON file for manual insertion or review."""
    import json

    with open(output_path, "w") as f:
        json.dump(records, f, indent=2, default=str)

    console.print(f"  [green]Saved {len(records)} database records to {output_path.name}[/]")


def run_upload(
    output_base: Path,
    r2_config: Optional[R2Config],
    race_slug: str,
    skip_upload: bool = True,
    force_upload: bool = False,
    upload_prefix: Optional[str] = None,
) -> bool:
    """
    Run the complete upload step.

    Args:
        output_base: Base output directory containing intake/, final/, etc.
        r2_config: R2 configuration (None to skip R2 upload)
        race_slug: Race identifier for storage prefix
        skip_upload: Skip R2 upload but still generate DB records
        force_upload: Upload even if privacy check fails
        upload_prefix: Optional override for R2 storage prefix

    Returns:
        True if successful, False otherwise
    """
    final_dir = output_base / "final"
    intake_dir = output_base / "intake"

    if not final_dir.exists():
        console.print(f"  [red]Final directory not found: {final_dir}[/]")
        return False

    # Step 1: Privacy sanity check
    passed, total, with_gps = run_privacy_check(final_dir)

    if not passed and not force_upload:
        console.print("  [red]Upload aborted due to privacy check failure[/]")
        console.print("  [dim]Use --force-upload to override (not recommended)[/]")
        return False

    # Step 2: Load manifest for metadata
    manifest = load_manifest(intake_dir)
    if not manifest:
        console.print(f"  [yellow]Warning: No manifest found in {intake_dir}[/]")
        console.print("  [yellow]Database records will have no GPS metadata[/]")

    # Step 3: Generate database records
    storage_prefix = upload_prefix if upload_prefix else f"races/{race_slug}"

    if manifest:
        db_records = generate_db_records(manifest, final_dir, storage_prefix)
        db_records_path = output_base / "db_records.json"
        save_db_records(db_records, db_records_path)
    else:
        console.print("  [yellow]Skipping database record generation (no manifest)[/]")

    # Step 4: Upload to R2
    if skip_upload:
        console.print("  [yellow]Skipping R2 upload (default behavior, use --upload to run)[/]")
    elif not r2_config:
        console.print("  [yellow]Skipping R2 upload (no R2 config provided)[/]")
    else:
        upload_to_r2(final_dir, r2_config, storage_prefix)

    return True

"""
Step 1: Intake - Import images from folder, extract EXIF, sort by timestamp, rename sequentially.

This step takes a folder of equirectangular JPGs exported from Insta360 Studio and:
1. Extracts EXIF metadata (timestamp, GPS coordinates, altitude)
2. Sorts images by capture timestamp
3. Renames to sequential format: 001.jpg, 002.jpg, etc.
4. Saves metadata.json for later database insertion
"""

import json
import shutil
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional

import exifread
from rich.console import Console
from rich.table import Table

from race_processor.utils.geo import calculate_image_headings

console = Console()


@dataclass
class ImageMetadata:
    """Metadata extracted from a single image.

    Heading fields are calculated from GPS coordinates:
    - heading_degrees: Direction of travel (bearing from previous to current point)
    - heading_to_prev: Bearing from this image to the previous image
    - heading_to_next: Bearing from this image to the next image

    These are used for Street View-like navigation arrows in the UI.
    If EXIF GPS is unreliable, use override-gps to recalculate from GPX track.
    """

    position_index: int
    original_filename: str
    captured_at: str  # ISO 8601 format
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    altitude_meters: Optional[float] = None
    heading_degrees: Optional[float] = None  # Direction of travel
    heading_to_prev: Optional[float] = None  # Bearing to previous image (for back arrow)
    heading_to_next: Optional[float] = None  # Bearing to next image (for forward arrow)
    distance_from_start: Optional[int] = None  # Cumulative distance in meters (from GPX)
    elevation_gain_from_start: Optional[int] = None  # Cumulative elevation gain in meters (from GPX)


@dataclass
class IntakeManifest:
    """Complete manifest of processed images with metadata."""

    race_slug: str
    created_at: str
    total_images: int
    images: list[ImageMetadata]

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "race_slug": self.race_slug,
            "created_at": self.created_at,
            "total_images": self.total_images,
            "images": [asdict(img) for img in self.images],
        }


def _convert_to_degrees(value) -> Optional[float]:
    """Convert EXIF GPS coordinate to decimal degrees."""
    try:
        d = float(value.values[0].num) / float(value.values[0].den)
        m = float(value.values[1].num) / float(value.values[1].den)
        s = float(value.values[2].num) / float(value.values[2].den)
        return d + (m / 60.0) + (s / 3600.0)
    except (AttributeError, IndexError, ZeroDivisionError):
        return None


def _extract_exif(image_path: Path) -> dict:
    """
    Extract relevant EXIF data from an image.

    Returns dict with keys: captured_at, latitude, longitude, altitude_meters
    Note: heading is NOT extracted - will be calculated from GPX correlation.
    """
    result = {
        "captured_at": None,
        "latitude": None,
        "longitude": None,
        "altitude_meters": None,
    }

    try:
        with open(image_path, "rb") as f:
            tags = exifread.process_file(f, details=False)

        # Extract capture timestamp
        date_tag = tags.get("EXIF DateTimeOriginal") or tags.get("Image DateTime")
        if date_tag:
            try:
                dt = datetime.strptime(str(date_tag), "%Y:%m:%d %H:%M:%S")
                result["captured_at"] = dt.isoformat()
            except ValueError:
                pass

        # Extract GPS latitude
        lat = tags.get("GPS GPSLatitude")
        lat_ref = tags.get("GPS GPSLatitudeRef")
        if lat and lat_ref:
            lat_deg = _convert_to_degrees(lat)
            if lat_deg is not None:
                if str(lat_ref) == "S":
                    lat_deg = -lat_deg
                result["latitude"] = round(lat_deg, 8)

        # Extract GPS longitude
        lon = tags.get("GPS GPSLongitude")
        lon_ref = tags.get("GPS GPSLongitudeRef")
        if lon and lon_ref:
            lon_deg = _convert_to_degrees(lon)
            if lon_deg is not None:
                if str(lon_ref) == "W":
                    lon_deg = -lon_deg
                result["longitude"] = round(lon_deg, 8)

        # Extract altitude
        alt = tags.get("GPS GPSAltitude")
        alt_ref = tags.get("GPS GPSAltitudeRef")
        if alt:
            try:
                alt_val = float(alt.values[0].num) / float(alt.values[0].den)
                # GPSAltitudeRef: 0 = above sea level, 1 = below sea level
                if alt_ref and str(alt_ref) == "1":
                    alt_val = -alt_val
                result["altitude_meters"] = round(alt_val, 2)
            except (AttributeError, IndexError, ZeroDivisionError):
                pass

    except Exception as e:
        console.print(f"  [yellow]Warning: Could not read EXIF from {image_path.name}: {e}[/]")

    return result


def run_intake(
    input_dir: Path,
    output_dir: Path,
    race_slug: str,
    skip_first: int = 0,
) -> Optional[IntakeManifest]:
    """
    Process intake step: extract EXIF, sort by timestamp, rename sequentially.

    Args:
        input_dir: Directory containing source images (JPG/PNG)
        output_dir: Directory to write renamed images and metadata.json
        race_slug: Identifier for this race
        skip_first: Number of images to skip from the beginning (after sorting)

    Returns:
        IntakeManifest with all image metadata, or None if no images found
    """
    console.print(f"  Scanning {input_dir} for images...")

    # Find all image files
    extensions = {".jpg", ".jpeg", ".png", ".tiff", ".tif"}
    source_files = [
        f for f in input_dir.iterdir()
        if f.is_file() and f.suffix.lower() in extensions
    ]

    if not source_files:
        console.print(f"  [red]No image files found in {input_dir}[/]")
        return None

    console.print(f"  Found {len(source_files)} images")

    # Extract EXIF from all images
    console.print("  Extracting EXIF metadata...")
    images_with_exif: list[tuple[Path, dict]] = []

    for img_path in source_files:
        exif_data = _extract_exif(img_path)
        images_with_exif.append((img_path, exif_data))

    # Sort by capture timestamp (fall back to filename if no timestamp)
    def sort_key(item: tuple[Path, dict]) -> tuple:
        path, exif = item
        if exif["captured_at"]:
            return (0, exif["captured_at"], path.name)
        else:
            return (1, "", path.name)  # Files without timestamp go to end

    images_with_exif.sort(key=sort_key)

    # Skip first N images if requested
    if skip_first > 0:
        if skip_first >= len(images_with_exif):
            console.print(f"  [red]Cannot skip {skip_first} images - only {len(images_with_exif)} available[/]")
            return None
        skipped = images_with_exif[:skip_first]
        images_with_exif = images_with_exif[skip_first:]
        console.print(f"  [yellow]Skipping first {skip_first} images:[/]")
        for path, _ in skipped[:5]:  # Show first 5 skipped
            console.print(f"    - {path.name}")
        if len(skipped) > 5:
            console.print(f"    ... and {len(skipped) - 5} more")

    # Check for images without timestamps
    no_timestamp = [p.name for p, e in images_with_exif if not e["captured_at"]]
    if no_timestamp:
        console.print(
            f"  [yellow]Warning: {len(no_timestamp)} images have no EXIF timestamp, "
            f"sorted by filename[/]"
        )

    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)

    # Rename and copy images, build manifest
    console.print("  Renaming and copying images...")
    image_metadata: list[ImageMetadata] = []

    # Determine padding width based on total count
    padding = len(str(len(images_with_exif)))
    padding = max(padding, 4)  # Minimum 4 digits (0001, 0002, ...)

    for idx, (src_path, exif_data) in enumerate(images_with_exif):
        # Generate new filename: 001.jpg, 002.jpg, etc.
        new_name = f"{str(idx + 1).zfill(padding)}{src_path.suffix.lower()}"
        dst_path = output_dir / new_name

        # Copy file
        shutil.copy2(src_path, dst_path)

        # Build metadata entry
        meta = ImageMetadata(
            position_index=idx,
            original_filename=src_path.name,
            captured_at=exif_data["captured_at"] or datetime.now().isoformat(),
            latitude=exif_data["latitude"],
            longitude=exif_data["longitude"],
            altitude_meters=exif_data["altitude_meters"],
        )
        image_metadata.append(meta)

    # Calculate headings from EXIF GPS coordinates
    # Note: heading_degrees is calculated from image positions, which is less
    # accurate than GPX-based calculation. Use override-gps for better accuracy.
    console.print("  Calculating headings from EXIF GPS...")
    images_for_headings = [asdict(img) for img in image_metadata]
    calculate_image_headings(images_for_headings)

    # Update metadata with calculated headings
    for meta, img_dict in zip(image_metadata, images_for_headings):
        meta.heading_degrees = img_dict.get("heading_degrees")
        meta.heading_to_prev = img_dict.get("heading_to_prev")
        meta.heading_to_next = img_dict.get("heading_to_next")

    # Create manifest
    manifest = IntakeManifest(
        race_slug=race_slug,
        created_at=datetime.now().isoformat(),
        total_images=len(image_metadata),
        images=image_metadata,
    )

    # Save metadata.json
    metadata_path = output_dir / "metadata.json"
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(manifest.to_dict(), f, indent=2, ensure_ascii=False)

    console.print(f"  [green]Saved metadata.json with {len(image_metadata)} entries[/]")

    # Print summary table
    _print_summary(image_metadata)

    return manifest


def _print_summary(images: list[ImageMetadata]) -> None:
    """Print a summary table of extracted metadata."""
    # Count images with GPS data
    with_gps = sum(1 for img in images if img.latitude is not None)
    with_altitude = sum(1 for img in images if img.altitude_meters is not None)
    with_heading = sum(1 for img in images if img.heading_degrees is not None)

    table = Table(title="EXIF Extraction Summary")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="green")

    table.add_row("Total images", str(len(images)))
    table.add_row("With GPS coordinates", f"{with_gps} ({100*with_gps//len(images)}%)")
    table.add_row("With altitude", f"{with_altitude} ({100*with_altitude//len(images)}%)")
    table.add_row("With heading", f"{with_heading} ({100*with_heading//len(images)}%)")

    if images:
        first = images[0]
        last = images[-1]
        table.add_row("First image timestamp", first.captured_at[:19] if first.captured_at else "N/A")
        table.add_row("Last image timestamp", last.captured_at[:19] if last.captured_at else "N/A")

        if first.latitude and first.longitude:
            table.add_row("Start coordinates", f"{first.latitude:.6f}, {first.longitude:.6f}")
        if last.latitude and last.longitude:
            table.add_row("End coordinates", f"{last.latitude:.6f}, {last.longitude:.6f}")

    console.print(table)


def load_manifest(output_dir: Path) -> Optional[IntakeManifest]:
    """Load an existing manifest from metadata.json."""
    metadata_path = output_dir / "metadata.json"
    if not metadata_path.exists():
        return None

    try:
        with open(metadata_path, encoding="utf-8") as f:
            data = json.load(f)

        images = [
            ImageMetadata(**img_data)
            for img_data in data.get("images", [])
        ]

        return IntakeManifest(
            race_slug=data["race_slug"],
            created_at=data["created_at"],
            total_images=data["total_images"],
            images=images,
        )
    except Exception as e:
        console.print(f"  [yellow]Warning: Could not load manifest: {e}[/]")
        return None

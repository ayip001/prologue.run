"""
GPX Override Utility - Override image GPS data using GPX track data.

This utility correlates images with GPX track points by timestamp to override
latitude, longitude, and calculate heading direction.
"""

import json
from dataclasses import asdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import gpxpy
import gpxpy.gpx
from rich.console import Console
from rich.table import Table

from .geo import calculate_bearing

console = Console()


# Default UTC offset (hours ahead of UTC)
DEFAULT_UTC_OFFSET = 8


def parse_gpx_with_time(gpx_path: Path) -> list[dict]:
    """
    Parse GPX file into list of points with timestamp, lat, lon.

    Args:
        gpx_path: Path to the GPX file

    Returns:
        List of dicts with keys: time (datetime in UTC), lat, lon, elevation
    """
    with open(gpx_path) as f:
        gpx = gpxpy.parse(f)

    points: list[dict] = []

    for track in gpx.tracks:
        for segment in track.segments:
            for point in segment.points:
                if point.time is not None:
                    points.append({
                        "time": point.time.replace(tzinfo=None),  # Store as naive UTC
                        "lat": point.latitude,
                        "lon": point.longitude,
                        "elevation": point.elevation or 0,
                    })

    # Sort by time just in case
    points.sort(key=lambda p: p["time"])

    return points


def exif_time_to_utc(exif_time_str: str, utc_offset: int) -> datetime:
    """
    Convert EXIF timestamp (local time) to UTC.

    Args:
        exif_time_str: ISO format timestamp from EXIF (local time, no timezone)
        utc_offset: Hours ahead of UTC (e.g., 8 for UTC+8)

    Returns:
        datetime in UTC (naive, for comparison with GPX)
    """
    # Parse the EXIF time (stored as ISO format without timezone)
    dt = datetime.fromisoformat(exif_time_str)
    # Subtract UTC offset to get UTC time
    return dt - timedelta(hours=utc_offset)


def find_nearest_gpx_point(
    target_time: datetime,
    gpx_points: list[dict],
    debug: bool = False,
) -> tuple[Optional[int], Optional[float]]:
    """
    Find the GPX point with timestamp nearest to target_time.

    Args:
        target_time: Target time in UTC
        gpx_points: List of GPX points with 'time' key
        debug: Print debug information

    Returns:
        Tuple of (index of nearest point, time difference in seconds)
    """
    if not gpx_points:
        return None, None

    min_diff = float("inf")
    min_idx = 0

    for idx, point in enumerate(gpx_points):
        diff = abs((point["time"] - target_time).total_seconds())
        if diff < min_diff:
            min_diff = diff
            min_idx = idx

    if debug:
        console.print(f"    Nearest GPX point: index {min_idx}, diff {min_diff:.1f}s")

    return min_idx, min_diff


def calculate_heading_from_points(
    gpx_points: list[dict],
    current_idx: int,
    debug: bool = False,
) -> Optional[float]:
    """
    Calculate heading by drawing a line from current point to next point.

    Args:
        gpx_points: List of GPX points
        current_idx: Index of the current (nearest) point
        debug: Print debug information

    Returns:
        Heading in degrees (0-360, where 0 is North), or None if can't calculate
    """
    if current_idx is None or not gpx_points:
        return None

    # If we're at the last point, use previous point to current
    if current_idx >= len(gpx_points) - 1:
        if current_idx == 0:
            return None  # Only one point, can't calculate heading
        prev_point = gpx_points[current_idx - 1]
        curr_point = gpx_points[current_idx]
        heading = calculate_bearing(
            prev_point["lat"], prev_point["lon"],
            curr_point["lat"], curr_point["lon"]
        )
    else:
        # Use current to next point
        curr_point = gpx_points[current_idx]
        next_point = gpx_points[current_idx + 1]
        heading = calculate_bearing(
            curr_point["lat"], curr_point["lon"],
            next_point["lat"], next_point["lon"]
        )

    if debug:
        console.print(f"    Calculated heading: {heading:.2f} degrees")

    return round(heading, 2)


def override_gps_from_gpx(
    manifest_path: Path,
    gpx_path: Path,
    utc_offset: int = DEFAULT_UTC_OFFSET,
    debug: bool = False,
    max_time_diff_seconds: float = 60.0,
) -> dict:
    """
    Override GPS data in manifest using GPX track data.

    Args:
        manifest_path: Path to metadata.json (intake manifest)
        gpx_path: Path to GPX file
        utc_offset: Hours ahead of UTC (e.g., 8 for UTC+8)
        debug: Enable detailed logging
        max_time_diff_seconds: Maximum allowed time difference for matching (warning threshold)

    Returns:
        Updated manifest dict with GPS overrides
    """
    console.print(f"[bold]GPS Override Utility[/]")
    console.print(f"  Manifest: {manifest_path}")
    console.print(f"  GPX file: {gpx_path}")
    console.print(f"  UTC offset: +{utc_offset}")
    console.print()

    # Load manifest
    with open(manifest_path) as f:
        manifest = json.load(f)

    images = manifest.get("images", [])
    if not images:
        console.print("[red]No images found in manifest[/]")
        return manifest

    console.print(f"  Found {len(images)} images in manifest")

    # Parse GPX
    gpx_points = parse_gpx_with_time(gpx_path)
    if not gpx_points:
        console.print("[red]No track points with timestamps found in GPX[/]")
        return manifest

    console.print(f"  Found {len(gpx_points)} track points in GPX")

    if debug:
        console.print(f"  GPX time range: {gpx_points[0]['time']} to {gpx_points[-1]['time']} (UTC)")
        if images[0].get("captured_at"):
            first_img_utc = exif_time_to_utc(images[0]["captured_at"], utc_offset)
            console.print(f"  First image time: {images[0]['captured_at']} (local) -> {first_img_utc} (UTC)")

    console.print()
    console.print("[bold]Processing images...[/]")

    # Statistics
    stats = {
        "updated": 0,
        "no_timestamp": 0,
        "large_time_diff": 0,
        "total_time_diff": 0.0,
    }

    # Process each image
    for img in images:
        captured_at = img.get("captured_at")
        if not captured_at:
            stats["no_timestamp"] += 1
            if debug:
                console.print(f"  [yellow]Image {img.get('position_index', '?')}: No timestamp[/]")
            continue

        # Convert EXIF time to UTC
        img_time_utc = exif_time_to_utc(captured_at, utc_offset)

        if debug:
            console.print(f"\n  [cyan]Image {img['position_index']:03d}:[/] {img.get('original_filename', 'unknown')}")
            console.print(f"    EXIF time: {captured_at} (local)")
            console.print(f"    UTC time:  {img_time_utc}")

        # Find nearest GPX point
        nearest_idx, time_diff = find_nearest_gpx_point(img_time_utc, gpx_points, debug)

        if nearest_idx is None:
            if debug:
                console.print(f"    [yellow]No matching GPX point found[/]")
            continue

        # Check time difference
        if time_diff > max_time_diff_seconds:
            stats["large_time_diff"] += 1
            if debug:
                console.print(f"    [yellow]Warning: Large time difference ({time_diff:.1f}s > {max_time_diff_seconds}s)[/]")

        stats["total_time_diff"] += time_diff

        # Get GPS coordinates from nearest point
        nearest_point = gpx_points[nearest_idx]
        old_lat = img.get("latitude")
        old_lon = img.get("longitude")

        img["latitude"] = round(nearest_point["lat"], 8)
        img["longitude"] = round(nearest_point["lon"], 8)
        img["altitude_meters"] = round(nearest_point["elevation"], 2)

        # Calculate heading
        heading = calculate_heading_from_points(gpx_points, nearest_idx, debug)
        if heading is not None:
            img["heading_degrees"] = heading

        stats["updated"] += 1

        if debug:
            console.print(f"    GPS: ({old_lat}, {old_lon}) -> ({img['latitude']}, {img['longitude']})")
            console.print(f"    Altitude: {img['altitude_meters']}m")
            if heading is not None:
                console.print(f"    Heading: {heading} degrees")

    # Print summary
    console.print()
    _print_summary(stats, images, gpx_points, utc_offset)

    return manifest


def save_manifest(manifest: dict, output_path: Path) -> None:
    """Save the updated manifest to a JSON file."""
    with open(output_path, "w") as f:
        json.dump(manifest, f, indent=2)
    console.print(f"\n[green]Saved updated manifest to:[/] {output_path}")


def _print_summary(
    stats: dict,
    images: list[dict],
    gpx_points: list[dict],
    utc_offset: int,
) -> None:
    """Print a summary table of the GPS override operation."""
    table = Table(title="GPS Override Summary")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="green")

    table.add_row("Total images", str(len(images)))
    table.add_row("Updated with GPS", str(stats["updated"]))
    table.add_row("No timestamp", str(stats["no_timestamp"]))
    table.add_row("Large time diff warnings", str(stats["large_time_diff"]))

    if stats["updated"] > 0:
        avg_diff = stats["total_time_diff"] / stats["updated"]
        table.add_row("Avg time diff", f"{avg_diff:.1f}s")

    table.add_row("GPX track points", str(len(gpx_points)))
    table.add_row("UTC offset used", f"+{utc_offset}")

    # Show coordinate ranges if available
    updated_images = [img for img in images if img.get("latitude") is not None]
    if updated_images:
        lats = [img["latitude"] for img in updated_images]
        lons = [img["longitude"] for img in updated_images]
        table.add_row("Lat range", f"{min(lats):.6f} to {max(lats):.6f}")
        table.add_row("Lon range", f"{min(lons):.6f} to {max(lons):.6f}")

    # Show heading range
    headings = [img.get("heading_degrees") for img in images if img.get("heading_degrees") is not None]
    if headings:
        table.add_row("Heading range", f"{min(headings):.1f} to {max(headings):.1f} degrees")

    console.print(table)

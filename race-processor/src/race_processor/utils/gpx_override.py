"""
GPX Override Utility - Override image GPS data using GPX track data.

This utility correlates images with GPX track points using relative time matching:
- First photo is assumed to correspond to first GPX point (plus optional offset)
- Subsequent photos are matched based on elapsed time from the first photo
"""

import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import gpxpy
import gpxpy.gpx
from rich.console import Console
from rich.table import Table

from .geo import calculate_bearing

console = Console()


def parse_gpx_with_time(gpx_path: Path) -> list[dict]:
    """
    Parse GPX file into list of points with timestamp, lat, lon.

    Args:
        gpx_path: Path to the GPX file

    Returns:
        List of dicts with keys: time (datetime), lat, lon, elevation
    """
    with open(gpx_path) as f:
        gpx = gpxpy.parse(f)

    points: list[dict] = []

    for track in gpx.tracks:
        for segment in track.segments:
            for point in segment.points:
                if point.time is not None:
                    points.append({
                        "time": point.time.replace(tzinfo=None),  # Store as naive
                        "lat": point.latitude,
                        "lon": point.longitude,
                        "elevation": point.elevation or 0,
                    })

    # Sort by time just in case
    points.sort(key=lambda p: p["time"])

    return points


def find_gpx_point_by_elapsed_time(
    elapsed_seconds: float,
    gpx_points: list[dict],
    gpx_start_time: datetime,
    debug: bool = False,
) -> tuple[Optional[int], Optional[float]]:
    """
    Find the GPX point that matches the target elapsed time from GPX start.

    Args:
        elapsed_seconds: Seconds elapsed since start (photo time - first photo time + offset)
        gpx_points: List of GPX points with 'time' key
        gpx_start_time: Time of the first GPX point
        debug: Print debug information

    Returns:
        Tuple of (index of nearest point, time difference in seconds)
    """
    if not gpx_points:
        return None, None

    target_time = gpx_start_time + timedelta(seconds=elapsed_seconds)

    min_diff = float("inf")
    min_idx = 0

    for idx, point in enumerate(gpx_points):
        diff = abs((point["time"] - target_time).total_seconds())
        if diff < min_diff:
            min_diff = diff
            min_idx = idx

    if debug:
        console.print(f"    Target GPX time: {target_time}")
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
    offset_seconds: float = 0.0,
    debug: bool = False,
    max_time_diff_seconds: float = 60.0,
) -> dict:
    """
    Override GPS data in manifest using GPX track data with relative time matching.

    The first photo is assumed to correspond to the first GPX point. Subsequent
    photos are matched based on elapsed time since the first photo.

    Args:
        manifest_path: Path to metadata.json (intake manifest)
        gpx_path: Path to GPX file
        offset_seconds: Time offset in seconds. Positive if camera started after
                       GPX recording (e.g., +2 means camera was pressed 2 seconds
                       after starting the GPS watch). Default: 0
        debug: Enable detailed logging
        max_time_diff_seconds: Maximum allowed time difference for matching (warning threshold)

    Returns:
        Updated manifest dict with GPS overrides
    """
    console.print("[bold]GPS Override Utility[/]")
    console.print(f"  Manifest: {manifest_path}")
    console.print(f"  GPX file: {gpx_path}")
    console.print(f"  Offset: {offset_seconds:+.1f}s (camera vs GPX start)")
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

    # Get reference times
    gpx_start_time = gpx_points[0]["time"]
    gpx_end_time = gpx_points[-1]["time"]
    gpx_duration = (gpx_end_time - gpx_start_time).total_seconds()

    # Find first image with timestamp
    first_img_time = None
    for img in images:
        if img.get("captured_at"):
            first_img_time = datetime.fromisoformat(img["captured_at"])
            break

    if first_img_time is None:
        console.print("[red]No images with timestamps found[/]")
        return manifest

    # Find last image with timestamp for duration calculation
    last_img_time = first_img_time
    for img in reversed(images):
        if img.get("captured_at"):
            last_img_time = datetime.fromisoformat(img["captured_at"])
            break

    photo_duration = (last_img_time - first_img_time).total_seconds()

    if debug:
        console.print(f"  GPX time range: {gpx_start_time} to {gpx_end_time}")
        console.print(f"  GPX duration: {gpx_duration:.1f}s ({gpx_duration/60:.1f} min)")
        console.print(f"  Photo time range: {first_img_time} to {last_img_time}")
        console.print(f"  Photo duration: {photo_duration:.1f}s ({photo_duration/60:.1f} min)")
        console.print(f"  Offset applied: {offset_seconds:+.1f}s")

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

        # Calculate elapsed time since first photo
        img_time = datetime.fromisoformat(captured_at)
        elapsed_from_first_photo = (img_time - first_img_time).total_seconds()

        # Apply offset: if camera started 2s after GPX, we add 2s to elapsed time
        # to find the correct GPX point
        elapsed_in_gpx = elapsed_from_first_photo + offset_seconds

        if debug:
            console.print(f"\n  [cyan]Image {img['position_index']:03d}:[/] {img.get('original_filename', 'unknown')}")
            console.print(f"    Photo time: {captured_at}")
            console.print(f"    Elapsed from first photo: {elapsed_from_first_photo:.1f}s")
            console.print(f"    Elapsed in GPX (with offset): {elapsed_in_gpx:.1f}s")

        # Find nearest GPX point by elapsed time
        nearest_idx, time_diff = find_gpx_point_by_elapsed_time(
            elapsed_in_gpx, gpx_points, gpx_start_time, debug
        )

        if nearest_idx is None:
            if debug:
                console.print("    [yellow]No matching GPX point found[/]")
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
    _print_summary(stats, images, gpx_points, offset_seconds, gpx_duration, photo_duration)

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
    offset_seconds: float,
    gpx_duration: float,
    photo_duration: float,
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
    table.add_row("GPX duration", f"{gpx_duration:.0f}s ({gpx_duration/60:.1f} min)")
    table.add_row("Photo duration", f"{photo_duration:.0f}s ({photo_duration/60:.1f} min)")
    table.add_row("Offset used", f"{offset_seconds:+.1f}s")

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

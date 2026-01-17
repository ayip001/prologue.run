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

from .geo import calculate_bearing, calculate_image_headings, haversine_distance

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


def calculate_cumulative_distances(gpx_points: list[dict]) -> list[int]:
    """
    Pre-calculate cumulative distance from start for each GPX point.

    This is done once upfront for efficiency, so each image lookup is O(1)
    instead of recalculating the sum each time.

    Args:
        gpx_points: List of GPX points with 'lat', 'lon' keys

    Returns:
        List of cumulative distances in meters (integer), same length as gpx_points
    """
    if not gpx_points:
        return []

    cumulative = [0]  # First point is at distance 0

    for i in range(1, len(gpx_points)):
        prev = gpx_points[i - 1]
        curr = gpx_points[i]

        segment_dist = haversine_distance(
            prev["lat"], prev["lon"],
            curr["lat"], curr["lon"]
        )

        cumulative.append(cumulative[-1] + int(round(segment_dist)))

    return cumulative


def calculate_cumulative_elevation_gain(gpx_points: list[dict]) -> list[int]:
    """
    Pre-calculate cumulative elevation gain from start for each GPX point.

    Uses noise filtering (3m threshold) to avoid counting GPS noise as elevation gain.
    This is done once upfront for efficiency, so each image lookup is O(1).

    Args:
        gpx_points: List of GPX points with 'elevation' key

    Returns:
        List of cumulative elevation gains in meters (integer), same length as gpx_points
    """
    if not gpx_points:
        return []

    # Import the filtered calculation from gpx_process to keep logic consistent
    from .gpx_process import calculate_cumulative_elevation_gain_filtered

    elevations = [p.get("elevation", 0) for p in gpx_points]
    return calculate_cumulative_elevation_gain_filtered(elevations, threshold=3.0)


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


def calculate_heading_from_gpx(
    gpx_points: list[dict],
    current_idx: int,
) -> Optional[float]:
    """
    Calculate heading (direction of travel) using fine-grained GPX data.

    Calculates heading by drawing an average line using a 5-point window
    centered on the current position (2 points behind, current point, 2 points ahead).
    At the start and end of the track, the window is shifted to still use 5 points.

    Args:
        gpx_points: List of GPX points with 'time', 'lat', 'lon' keys
        current_idx: Index of the current GPX point

    Returns:
        Heading in degrees (0-360, where 0 is North), or None if can't calculate
    """
    if current_idx is None or not gpx_points:
        return None

    n = len(gpx_points)
    if n < 2:
        return None

    # We want a 5-point window for smoothing
    window_size = 5

    if n < window_size:
        # Fallback for very short tracks: use first and last points
        start_idx = 0
        end_idx = n - 1
    else:
        # Center window on current_idx, but shift if at start/end to keep it window_size long
        # This ensures we always use 5 points even at the edges
        start_idx = max(0, min(current_idx - 2, n - window_size))
        end_idx = start_idx + window_size - 1

    # Calculate bearing from start of window to end of window for a smoothed direction
    return round(calculate_bearing(
        gpx_points[start_idx]["lat"], gpx_points[start_idx]["lon"],
        gpx_points[end_idx]["lat"], gpx_points[end_idx]["lon"]
    ), 2)


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

    Calculates all heading fields:
    - heading_degrees: Direction of travel (from current GPX point to next second's
      GPX point) - uses fine-grained GPX data for accurate direction
    - heading_to_prev: Bearing from this image to previous image (for back arrow)
    - heading_to_next: Bearing from this image to next image (for forward arrow)

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

    # Check elevation data in GPX
    elevations = [p.get("elevation", 0) for p in gpx_points]
    non_zero_elevations = [e for e in elevations if e != 0]
    if non_zero_elevations:
        console.print(f"  GPX elevations: min={min(non_zero_elevations):.1f}m, max={max(non_zero_elevations):.1f}m")
    else:
        console.print("  [yellow]Warning: GPX file has no elevation data (all elevations are 0 or None)[/]")

    # Pre-calculate cumulative distances for all GPX points (O(n) once, O(1) per image lookup)
    gpx_cumulative_distances = calculate_cumulative_distances(gpx_points)
    total_gpx_distance = gpx_cumulative_distances[-1] if gpx_cumulative_distances else 0
    console.print(f"  Total GPX track distance: {total_gpx_distance:,} meters ({total_gpx_distance/1000:.2f} km)")

    # Pre-calculate cumulative elevation gain for all GPX points (O(n) once, O(1) per image lookup)
    gpx_cumulative_elevation_gain = calculate_cumulative_elevation_gain(gpx_points)
    total_gpx_elevation_gain = gpx_cumulative_elevation_gain[-1] if gpx_cumulative_elevation_gain else 0
    console.print(f"  Total GPX elevation gain: {total_gpx_elevation_gain:,} meters")

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

    # Process each image - update GPS coordinates
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
            console.print(f"\n  [cyan]Image {img['position_index']:04d}:[/] {img.get('original_filename', 'unknown')}")
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

        # Store GPX index for heading calculation
        img["_gpx_idx"] = nearest_idx

        # Assign cumulative distance from start (pre-calculated for efficiency)
        img["distance_from_start"] = gpx_cumulative_distances[nearest_idx]

        # Assign cumulative elevation gain from start (pre-calculated for efficiency)
        img["elevation_gain_from_start"] = gpx_cumulative_elevation_gain[nearest_idx]

        stats["updated"] += 1

        if debug:
            console.print(f"    GPS: ({old_lat}, {old_lon}) -> ({img['latitude']}, {img['longitude']})")
            console.print(f"    Altitude: {img['altitude_meters']}m")
            console.print(f"    Distance from start: {img['distance_from_start']:,}m")
            console.print(f"    Elevation gain from start: {img['elevation_gain_from_start']:,}m")

    # Calculate heading_degrees from GPX fine-grained data (direction of travel)
    # This uses a 5-point moving average for accurate direction
    console.print("\n  Calculating headings...")
    console.print("    heading_degrees: from GPX (5-point moving average)")
    console.print("    heading_to_prev/next: to adjacent images")

    for img in images:
        gpx_idx = img.pop("_gpx_idx", None)  # Remove temporary key
        if gpx_idx is not None:
            heading = calculate_heading_from_gpx(gpx_points, gpx_idx)
            if heading is not None:
                img["heading_degrees"] = heading

    # Calculate heading_to_prev and heading_to_next using image positions
    # (skip_heading_degrees=True since we already calculated it from GPX)
    calculate_image_headings(images, lat_key="latitude", lon_key="longitude", skip_heading_degrees=True)

    if debug:
        for img in images:
            if img.get("heading_degrees") is not None:
                console.print(
                    f"  Image {img['position_index']:04d}: "
                    f"heading={img.get('heading_degrees')}°, "
                    f"to_prev={img.get('heading_to_prev')}°, "
                    f"to_next={img.get('heading_to_next')}°"
                )

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
        table.add_row("Heading range", f"{min(headings):.1f}° to {max(headings):.1f}°")

    # Show distance range
    distances = [img.get("distance_from_start") for img in images if img.get("distance_from_start") is not None]
    if distances:
        max_dist = max(distances)
        table.add_row("Distance range", f"0 to {max_dist:,}m ({max_dist/1000:.2f} km)")

    # Show elevation gain range
    elev_gains = [img.get("elevation_gain_from_start") for img in images if img.get("elevation_gain_from_start") is not None]
    if elev_gains:
        max_gain = max(elev_gains)
        table.add_row("Elevation gain range", f"0 to {max_gain:,}m")

    console.print(table)

"""
GPX Processing Utility - Simplify GPX tracks for minimap and elevation display.

Creates simplified track data suitable for web display:
- Simplified polyline (configurable number of points)
- Geographic bounds
- Elevation profile data
- Total distance calculation
"""

import json
from pathlib import Path
from typing import Optional

import gpxpy
import gpxpy.gpx
from rich.console import Console
from rich.table import Table

from .geo import haversine_distance

console = Console()


def calculate_elevation_stats(
    elevations: list[float],
    threshold: float = 3.0,
) -> tuple[float, float]:
    """
    Calculate total elevation gain and loss with noise filtering.

    Uses a threshold-based accumulator to filter out GPS noise.
    Only counts elevation changes when the accumulated change in one
    direction exceeds the threshold before reversing.

    Args:
        elevations: List of elevation values in meters
        threshold: Minimum elevation change to count (default 3m, similar to Garmin)

    Returns:
        Tuple of (total_gain, total_loss) in meters
    """
    if len(elevations) < 2:
        return 0.0, 0.0

    total_gain = 0.0
    total_loss = 0.0

    # Track the "anchor" point - last confirmed elevation
    anchor_elevation = elevations[0]

    for i in range(1, len(elevations)):
        diff = elevations[i] - anchor_elevation

        # Only commit the change if it exceeds threshold
        if diff >= threshold:
            total_gain += diff
            anchor_elevation = elevations[i]
        elif diff <= -threshold:
            total_loss += abs(diff)
            anchor_elevation = elevations[i]

    return total_gain, total_loss


def calculate_cumulative_elevation_gain_filtered(
    elevations: list[float],
    threshold: float = 3.0,
) -> list[int]:
    """
    Calculate cumulative elevation gain from start with noise filtering.

    Args:
        elevations: List of elevation values in meters
        threshold: Minimum elevation change to count (default 3m)

    Returns:
        List of cumulative elevation gain values (same length as input)
    """
    if not elevations:
        return []

    cumulative = [0]
    anchor_elevation = elevations[0]
    current_gain = 0

    for i in range(1, len(elevations)):
        diff = elevations[i] - anchor_elevation

        if diff >= threshold:
            # Committed uphill change
            current_gain += diff
            anchor_elevation = elevations[i]
        elif diff <= -threshold:
            # Committed downhill change - just move anchor, no gain added
            anchor_elevation = elevations[i]

        cumulative.append(int(round(current_gain)))

    return cumulative


def parse_gpx_track(gpx_path: Path) -> list[dict]:
    """
    Parse GPX file into a list of track points.

    Args:
        gpx_path: Path to the GPX file

    Returns:
        List of dicts with keys: lat, lon, elevation, time (optional)
    """
    with open(gpx_path) as f:
        gpx = gpxpy.parse(f)

    points: list[dict] = []

    for track in gpx.tracks:
        for segment in track.segments:
            for point in segment.points:
                pt = {
                    "lat": point.latitude,
                    "lon": point.longitude,
                    "elevation": point.elevation or 0,
                }
                if point.time:
                    pt["time"] = point.time.isoformat()
                points.append(pt)

    return points


def calculate_cumulative_distances(points: list[dict]) -> list[float]:
    """
    Calculate cumulative distance from start for each point.

    Args:
        points: List of points with lat, lon keys

    Returns:
        List of cumulative distances in meters
    """
    distances = [0.0]

    for i in range(1, len(points)):
        prev = points[i - 1]
        curr = points[i]
        segment_dist = haversine_distance(
            prev["lat"], prev["lon"],
            curr["lat"], curr["lon"]
        )
        distances.append(distances[-1] + segment_dist)

    return distances


def simplify_track_rdp(
    points: list[dict],
    target_points: int = 200,
) -> list[dict]:
    """
    Simplify track using Ramer-Douglas-Peucker algorithm variant.

    This implementation ensures the first and last points are kept,
    and tries to maintain an even distribution of points.

    Args:
        points: List of points with lat, lon keys
        target_points: Target number of points in simplified track

    Returns:
        Simplified list of points
    """
    if len(points) <= target_points:
        return points

    # Calculate perpendicular distance from point to line
    def perpendicular_distance(point: dict, start: dict, end: dict) -> float:
        """Calculate perpendicular distance from point to line (start-end)."""
        if start["lat"] == end["lat"] and start["lon"] == end["lon"]:
            return haversine_distance(
                point["lat"], point["lon"],
                start["lat"], start["lon"]
            )

        # Use simple perpendicular distance calculation
        # For small areas, we can treat lat/lon as approximately planar
        dx = end["lon"] - start["lon"]
        dy = end["lat"] - start["lat"]

        # Normalize
        length = (dx * dx + dy * dy) ** 0.5
        if length == 0:
            return haversine_distance(
                point["lat"], point["lon"],
                start["lat"], start["lon"]
            )

        # Calculate perpendicular distance
        dist = abs(
            (end["lat"] - start["lat"]) * (start["lon"] - point["lon"])
            - (start["lat"] - point["lat"]) * (end["lon"] - start["lon"])
        ) / length

        # Convert to approximate meters (rough approximation)
        return dist * 111320  # ~1 degree latitude in meters

    def rdp_recursive(pts: list[dict], epsilon: float) -> list[dict]:
        """Recursive RDP simplification."""
        if len(pts) < 3:
            return pts

        # Find point with maximum distance
        max_dist = 0
        max_idx = 0
        start, end = pts[0], pts[-1]

        for i in range(1, len(pts) - 1):
            dist = perpendicular_distance(pts[i], start, end)
            if dist > max_dist:
                max_dist = dist
                max_idx = i

        # If max distance is greater than epsilon, recursively simplify
        if max_dist > epsilon:
            left = rdp_recursive(pts[:max_idx + 1], epsilon)
            right = rdp_recursive(pts[max_idx:], epsilon)
            return left[:-1] + right
        else:
            return [start, end]

    # Binary search for epsilon that gives us approximately target_points
    epsilon_low = 0.0
    epsilon_high = 10000.0  # 10km max tolerance

    best_result = points
    best_diff = len(points)

    for _ in range(20):  # Binary search iterations
        epsilon = (epsilon_low + epsilon_high) / 2
        result = rdp_recursive(points, epsilon)

        diff = abs(len(result) - target_points)
        if diff < best_diff:
            best_diff = diff
            best_result = result

        if len(result) < target_points:
            epsilon_high = epsilon
        elif len(result) > target_points:
            epsilon_low = epsilon
        else:
            break

    return best_result


def simplify_track_uniform(
    points: list[dict],
    target_points: int = 200,
) -> list[dict]:
    """
    Simplify track by selecting evenly-spaced points along the track.

    This ensures good coverage of the entire route.

    Args:
        points: List of points with lat, lon keys
        target_points: Target number of points

    Returns:
        Simplified list of points
    """
    if len(points) <= target_points:
        return points

    # Calculate cumulative distances
    distances = calculate_cumulative_distances(points)
    total_distance = distances[-1]

    if total_distance == 0:
        return points[:target_points]

    # Select points at uniform distance intervals
    simplified = [points[0]]  # Always include first point
    interval = total_distance / (target_points - 1)

    target_dist = interval
    for i in range(1, len(points) - 1):
        if distances[i] >= target_dist:
            simplified.append(points[i])
            target_dist += interval

    # Always include last point
    if simplified[-1] != points[-1]:
        simplified.append(points[-1])

    return simplified


def calculate_bounds(points: list[dict]) -> dict:
    """
    Calculate geographic bounds of the track.

    Args:
        points: List of points with lat, lon keys

    Returns:
        Dict with north, south, east, west bounds
    """
    if not points:
        return {"north": 0, "south": 0, "east": 0, "west": 0}

    lats = [p["lat"] for p in points]
    lons = [p["lon"] for p in points]

    return {
        "north": max(lats),
        "south": min(lats),
        "east": max(lons),
        "west": min(lons),
    }


def create_elevation_profile(
    points: list[dict],
    num_samples: int = 100,
) -> list[dict]:
    """
    Create elevation profile data for charting.

    Args:
        points: List of points with lat, lon, elevation keys
        num_samples: Number of samples in the profile

    Returns:
        List of dicts with distance_km and elevation_m keys
    """
    if not points:
        return []

    distances = calculate_cumulative_distances(points)
    total_distance = distances[-1]

    if total_distance == 0:
        return [{"distance_km": 0, "elevation_m": points[0].get("elevation", 0)}]

    profile = []
    interval = total_distance / (num_samples - 1)

    sample_idx = 0
    for i in range(num_samples):
        target_dist = i * interval

        # Find the segment containing this distance
        while sample_idx < len(distances) - 1 and distances[sample_idx + 1] < target_dist:
            sample_idx += 1

        # Interpolate elevation
        if sample_idx >= len(points) - 1:
            elevation = points[-1].get("elevation", 0)
        else:
            # Linear interpolation between points
            d1 = distances[sample_idx]
            d2 = distances[sample_idx + 1]
            e1 = points[sample_idx].get("elevation", 0)
            e2 = points[sample_idx + 1].get("elevation", 0)

            if d2 - d1 > 0:
                t = (target_dist - d1) / (d2 - d1)
                elevation = e1 + t * (e2 - e1)
            else:
                elevation = e1

        profile.append({
            "distance_km": round(target_dist / 1000, 3),
            "elevation_m": round(elevation, 1),
        })

    return profile


def process_gpx(
    gpx_path: Path,
    target_points: int = 200,
    elevation_samples: int = 100,
    simplification_method: str = "uniform",
    debug: bool = False,
) -> dict:
    """
    Process GPX file into simplified data for web display.

    Args:
        gpx_path: Path to GPX file
        target_points: Target number of points for simplified polyline
        elevation_samples: Number of samples for elevation profile
        simplification_method: 'uniform' (distance-based) or 'rdp' (shape-based)
        debug: Enable debug output

    Returns:
        Dict with keys: polyline, bounds, elevation_profile, total_distance_km, stats
    """
    console.print("[bold]GPX Processing Utility[/]")
    console.print(f"  Input: {gpx_path}")
    console.print(f"  Target points: {target_points}")
    console.print(f"  Simplification: {simplification_method}")
    console.print()

    # Parse GPX
    points = parse_gpx_track(gpx_path)
    if not points:
        console.print("[red]No track points found in GPX[/]")
        return {}

    console.print(f"  Found {len(points)} track points")

    # Calculate total distance
    distances = calculate_cumulative_distances(points)
    total_distance_m = distances[-1]
    total_distance_km = total_distance_m / 1000

    console.print(f"  Total distance: {total_distance_km:.2f} km")

    # Simplify track
    console.print(f"\n  Simplifying to ~{target_points} points...")
    if simplification_method == "rdp":
        simplified = simplify_track_rdp(points, target_points)
    else:
        simplified = simplify_track_uniform(points, target_points)

    console.print(f"  Simplified to {len(simplified)} points")

    # Calculate bounds
    bounds = calculate_bounds(points)

    # Create elevation profile
    console.print(f"  Creating elevation profile ({elevation_samples} samples)...")
    elevation_profile = create_elevation_profile(points, elevation_samples)

    # Calculate elevation stats with noise filtering
    elevations = [p.get("elevation", 0) for p in points]
    min_elevation = min(elevations) if elevations else 0
    max_elevation = max(elevations) if elevations else 0

    # Calculate gain/loss with 3m threshold filter (like Garmin)
    total_gain, total_loss = calculate_elevation_stats(elevations, threshold=1.0)

    result = {
        "polyline": [{"lat": p["lat"], "lon": p["lon"]} for p in simplified],
        "bounds": bounds,
        "elevation_profile": elevation_profile,
        "total_distance_km": round(total_distance_km, 2),
        "stats": {
            "original_points": len(points),
            "simplified_points": len(simplified),
            "min_elevation_m": round(min_elevation, 1),
            "max_elevation_m": round(max_elevation, 1),
            "total_gain_m": round(total_gain, 1),
            "total_loss_m": round(total_loss, 1),
        },
    }

    # Print summary
    _print_summary(result)

    return result


def save_processed_gpx(data: dict, output_path: Path) -> None:
    """Save processed GPX data to JSON file."""
    with open(output_path, "w") as f:
        json.dump(data, f, indent=2)
    console.print(f"\n[green]Saved processed GPX to:[/] {output_path}")


def _print_summary(result: dict) -> None:
    """Print a summary table of the processed GPX."""
    table = Table(title="GPX Processing Summary")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="green")

    stats = result.get("stats", {})
    table.add_row("Original points", str(stats.get("original_points", 0)))
    table.add_row("Simplified points", str(stats.get("simplified_points", 0)))
    table.add_row("Total distance", f"{result.get('total_distance_km', 0):.2f} km")
    table.add_row("Min elevation", f"{stats.get('min_elevation_m', 0):.1f} m")
    table.add_row("Max elevation", f"{stats.get('max_elevation_m', 0):.1f} m")
    table.add_row("Total gain", f"{stats.get('total_gain_m', 0):.1f} m")
    table.add_row("Total loss", f"{stats.get('total_loss_m', 0):.1f} m")

    bounds = result.get("bounds", {})
    table.add_row("Lat range", f"{bounds.get('south', 0):.6f} to {bounds.get('north', 0):.6f}")
    table.add_row("Lon range", f"{bounds.get('west', 0):.6f} to {bounds.get('east', 0):.6f}")

    console.print()
    console.print(table)


def extract_gpx_race_stats(gpx_path: Path) -> dict:
    """
    Extract race-level statistics from GPX file for updating race records.

    This is a lightweight function that calculates only the stats needed
    for race metadata updates (distance, elevation gain/loss, min/max elevation).

    Args:
        gpx_path: Path to GPX file

    Returns:
        Dict with keys: distance_meters, elevation_gain, elevation_loss, elevation_min, elevation_max
    """
    # Parse GPX
    points = parse_gpx_track(gpx_path)
    if not points:
        return {}

    # Calculate total distance
    distances = calculate_cumulative_distances(points)
    total_distance_m = distances[-1] if distances else 0

    # Calculate elevation stats with noise filtering (3m threshold like Garmin)
    elevations = [p.get("elevation", 0) for p in points]
    total_gain, total_loss = calculate_elevation_stats(elevations, threshold=1.0)

    # Calculate min/max elevation
    elevation_min = int(round(min(elevations))) if elevations else 0
    elevation_max = int(round(max(elevations))) if elevations else 0

    return {
        "distance_meters": int(round(total_distance_m)),
        "elevation_gain": int(round(total_gain)),
        "elevation_loss": int(round(total_loss)),
        "elevation_min": elevation_min,
        "elevation_max": elevation_max,
    }

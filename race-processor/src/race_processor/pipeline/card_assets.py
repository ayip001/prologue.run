"""
Generates race card display assets from GPX data.
"""

import json
from pathlib import Path
from typing import Any

import gpxpy
import gpxpy.gpx


def generate_elevation_bars(gpx_points: list[dict[str, float]], num_bars: int = 35) -> list[int]:
    """
    Generate elevation bar heights (0-100) for race card display.

    Samples GPX at regular intervals and normalizes to 0-100 scale.
    """
    if not gpx_points:
        return []

    total_distance = gpx_points[-1].get("distance", 0)
    if total_distance == 0:
        return []

    step = total_distance / num_bars

    sampled_elevations: list[float] = []
    for i in range(num_bars):
        target_dist = i * step
        elevation = interpolate_elevation_at_distance(gpx_points, target_dist)
        sampled_elevations.append(elevation)

    # Normalize to 0-100 scale
    min_elev = min(sampled_elevations)
    max_elev = max(sampled_elevations)
    range_elev = max_elev - min_elev or 1

    return [
        int(((e - min_elev) / range_elev) * 80 + 10)  # 10-90 range for visual balance
        for e in sampled_elevations
    ]


def interpolate_elevation_at_distance(
    points: list[dict[str, float]], target_dist: float
) -> float:
    """Interpolate elevation at a given distance from a list of points."""
    if not points:
        return 0

    for i, point in enumerate(points):
        if point.get("distance", 0) >= target_dist:
            if i == 0:
                return point.get("elevation", 0)
            prev = points[i - 1]
            curr = point

            prev_dist = prev.get("distance", 0)
            curr_dist = curr.get("distance", 0)

            if curr_dist == prev_dist:
                return curr.get("elevation", 0)

            t = (target_dist - prev_dist) / (curr_dist - prev_dist)
            prev_elev = prev.get("elevation", 0)
            curr_elev = curr.get("elevation", 0)
            return prev_elev + (curr_elev - prev_elev) * t

    return points[-1].get("elevation", 0)


def generate_route_overlay_svg(
    gpx_points: list[dict[str, float]], width: int = 400, height: int = 200
) -> str:
    """Generate simplified route SVG for card image overlay."""
    if not gpx_points:
        return ""

    # Get bounds
    lats = [p["lat"] for p in gpx_points]
    lons = [p["lon"] for p in gpx_points]

    min_lat, max_lat = min(lats), max(lats)
    min_lon, max_lon = min(lons), max(lons)

    lat_range = max_lat - min_lat or 0.001
    lon_range = max_lon - min_lon or 0.001

    padding = 20

    def project(lat: float, lon: float) -> tuple[float, float]:
        x = padding + ((lon - min_lon) / lon_range) * (width - 2 * padding)
        y = height - padding - ((lat - min_lat) / lat_range) * (height - 2 * padding)
        return x, y

    # Simplify to ~50-100 points
    step = max(1, len(gpx_points) // 100)
    simplified = gpx_points[::step]

    coords = [project(p["lat"], p["lon"]) for p in simplified]

    # Generate path
    path_d = f"M {coords[0][0]:.1f} {coords[0][1]:.1f}"
    for x, y in coords[1:]:
        path_d += f" L {x:.1f} {y:.1f}"

    svg = f'''<svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FF6B6B"/>
      <stop offset="100%" stop-color="#FFD166"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <path d="{path_d}" fill="none" stroke="url(#routeGradient)"
        stroke-width="3" filter="url(#glow)"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>'''

    return svg


def parse_gpx(gpx_path: Path) -> list[dict[str, float]]:
    """Parse GPX file into list of points with distance."""
    with open(gpx_path) as f:
        gpx = gpxpy.parse(f)

    points: list[dict[str, float]] = []
    cumulative_distance = 0.0
    prev_point = None

    for track in gpx.tracks:
        for segment in track.segments:
            for point in segment.points:
                if prev_point:
                    cumulative_distance += point.distance_3d(prev_point) or 0

                points.append({
                    "lat": point.latitude,
                    "lon": point.longitude,
                    "elevation": point.elevation or 0,
                    "distance": cumulative_distance,
                })
                prev_point = point

    return points


def generate_all_card_assets(gpx_path: Path, output_dir: Path, race_slug: str) -> None:
    """Generate all card assets from GPX data."""
    points = parse_gpx(gpx_path)

    # Elevation bars
    bars = generate_elevation_bars(points)
    with open(output_dir / "elevation-bars.json", "w") as f:
        json.dump(bars, f)

    # Route overlay SVG
    svg = generate_route_overlay_svg(points)
    with open(output_dir / "route-overlay.svg", "w") as f:
        f.write(svg)

    # Elevation profile points
    profile_points = [
        {"distance_meters": int(p["distance"]), "elevation_meters": round(p["elevation"], 2)}
        for p in points[:: max(1, len(points) // 200)]
    ]
    with open(output_dir / "elevation-profile.json", "w") as f:
        json.dump(profile_points, f)

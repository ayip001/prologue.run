"""
Geographic calculation utilities.
"""

import math


def haversine_distance(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> float:
    """
    Calculate distance between two GPS coordinates using Haversine formula.

    Args:
        lat1, lon1: First coordinate (degrees)
        lat2, lon2: Second coordinate (degrees)

    Returns:
        Distance in meters
    """
    R = 6371e3  # Earth's radius in meters

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


def calculate_bearing(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> float:
    """
    Calculate bearing from point 1 to point 2.

    Args:
        lat1, lon1: First coordinate (degrees)
        lat2, lon2: Second coordinate (degrees)

    Returns:
        Bearing in degrees (0-360, where 0 is North)
    """
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_lambda = math.radians(lon2 - lon1)

    x = math.sin(delta_lambda) * math.cos(phi2)
    y = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(
        delta_lambda
    )

    bearing = math.atan2(x, y)
    bearing_degrees = math.degrees(bearing)

    # Normalize to 0-360
    return (bearing_degrees + 360) % 360


def calculate_image_headings(
    images: list[dict],
    lat_key: str = "latitude",
    lon_key: str = "longitude",
    skip_heading_degrees: bool = False,
) -> None:
    """
    Calculate heading fields for a list of images with GPS coordinates.

    Updates each image dict in-place with:
    - heading_degrees: Direction of travel (bearing from prev to current, or current to next)
      Only calculated if skip_heading_degrees=False. When GPX data is available,
      heading_degrees should be calculated from fine-grained GPX points instead.
    - heading_to_prev: Bearing from this image to the previous image
    - heading_to_next: Bearing from this image to the next image

    These are used for Street View-like navigation arrows in the UI.

    Args:
        images: List of image dicts with lat/lon coordinates
        lat_key: Key name for latitude in the dict
        lon_key: Key name for longitude in the dict
        skip_heading_degrees: If True, don't calculate heading_degrees (caller will
            calculate it separately using GPX data)
    """
    n = len(images)
    if n == 0:
        return

    for i, img in enumerate(images):
        lat = img.get(lat_key)
        lon = img.get(lon_key)

        if lat is None or lon is None:
            # No GPS for this image, skip
            continue

        # Get previous image with GPS
        prev_lat, prev_lon = None, None
        for j in range(i - 1, -1, -1):
            plat = images[j].get(lat_key)
            plon = images[j].get(lon_key)
            if plat is not None and plon is not None:
                prev_lat, prev_lon = plat, plon
                break

        # Get next image with GPS
        next_lat, next_lon = None, None
        for j in range(i + 1, n):
            nlat = images[j].get(lat_key)
            nlon = images[j].get(lon_key)
            if nlat is not None and nlon is not None:
                next_lat, next_lon = nlat, nlon
                break

        # Calculate heading_to_prev (bearing FROM current TO previous)
        if prev_lat is not None and prev_lon is not None:
            img["heading_to_prev"] = round(calculate_bearing(lat, lon, prev_lat, prev_lon), 2)

        # Calculate heading_to_next (bearing FROM current TO next)
        if next_lat is not None and next_lon is not None:
            img["heading_to_next"] = round(calculate_bearing(lat, lon, next_lat, next_lon), 2)

        # Calculate heading_degrees (direction of travel)
        # Only if not skipped (caller may calculate from GPX data instead)
        if not skip_heading_degrees:
            # Prefer using previous->current bearing, fall back to current->next
            if prev_lat is not None and prev_lon is not None:
                img["heading_degrees"] = round(calculate_bearing(prev_lat, prev_lon, lat, lon), 2)
            elif next_lat is not None and next_lon is not None:
                img["heading_degrees"] = round(calculate_bearing(lat, lon, next_lat, next_lon), 2)

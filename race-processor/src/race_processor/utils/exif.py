"""
EXIF extraction utilities.
"""

from pathlib import Path
from typing import Optional, TypedDict


class GPSData(TypedDict, total=False):
    """GPS data extracted from EXIF."""

    latitude: float
    longitude: float
    altitude: float
    heading: float


def extract_gps_from_insp(path: Path) -> Optional[GPSData]:
    """
    Extract GPS data from an Insta360 .insp file.

    Note: .insp files contain embedded metadata in a proprietary format.
    This is a placeholder that returns None. Full implementation requires
    parsing the Insta360 metadata format or using the Insta360 SDK.

    Args:
        path: Path to .insp file

    Returns:
        GPSData dict or None if GPS data not available
    """
    # TODO: Implement actual EXIF/metadata extraction
    # Options:
    # 1. Use exifread library (may not work with .insp)
    # 2. Use Insta360 SDK to extract metadata
    # 3. Parse embedded GPS stream in the file
    return None

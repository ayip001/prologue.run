"""
Discovers raw files, extracts EXIF metadata, and creates processing manifest.
"""

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional
import math

from pydantic import BaseModel

from ..insta360.filename import discover_insp_files, Insta360FileInfo
from ..utils.exif import extract_gps_from_insp
from ..utils.geo import haversine_distance


class ImageSource(BaseModel):
    """Metadata for a single source image."""

    source_path: Path
    original_filename: str
    position_index: int
    captured_at: datetime
    sequence_number: int
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    altitude: Optional[float] = None
    heading: Optional[float] = None
    distance_from_start: int = 0


class ProcessingManifest(BaseModel):
    """Complete manifest for processing a race."""

    race_slug: str
    sources: list[ImageSource]
    total_distance: int
    capture_device: str = "Insta360 X4"
    gpx_file: Optional[Path] = None


def discover_and_create_manifest(
    input_dir: Path,
    gpx_file: Optional[Path] = None,
    race_slug: str = "unknown",
) -> ProcessingManifest:
    """
    Discover .insp files and create a processing manifest.

    Args:
        input_dir: Directory containing insp/ subdirectory or .insp files directly
        gpx_file: Optional GPX file to associate
        race_slug: Race identifier for the manifest

    Returns:
        ProcessingManifest with ordered list of ImageSource objects
    """
    # Find .insp directory
    insp_dir = input_dir / "insp" if (input_dir / "insp").exists() else input_dir

    # Discover and sort files
    files = discover_insp_files(insp_dir)

    if not files:
        raise ValueError(f"No valid .insp files found in {insp_dir}")

    # Convert to ImageSource objects with EXIF data
    sources: list[ImageSource] = []
    prev_lat: Optional[float] = None
    prev_lon: Optional[float] = None
    cumulative_distance = 0

    for idx, file_info in enumerate(files):
        # Extract GPS from EXIF
        gps_data = extract_gps_from_insp(file_info.path)

        # Calculate distance from previous point
        if gps_data and prev_lat is not None and prev_lon is not None:
            distance = haversine_distance(
                prev_lat, prev_lon, gps_data["latitude"], gps_data["longitude"]
            )
            cumulative_distance += int(distance)

        if gps_data:
            prev_lat = gps_data["latitude"]
            prev_lon = gps_data["longitude"]

        source = ImageSource(
            source_path=file_info.path,
            original_filename=file_info.path.name,
            position_index=idx,
            captured_at=file_info.captured_at,
            sequence_number=file_info.sequence_number,
            latitude=gps_data["latitude"] if gps_data else None,
            longitude=gps_data["longitude"] if gps_data else None,
            altitude=gps_data.get("altitude") if gps_data else None,
            heading=gps_data.get("heading") if gps_data else None,
            distance_from_start=cumulative_distance,
        )
        sources.append(source)

    return ProcessingManifest(
        race_slug=race_slug,
        sources=sources,
        total_distance=cumulative_distance,
        gpx_file=gpx_file,
    )

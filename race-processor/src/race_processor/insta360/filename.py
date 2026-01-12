"""
Parses Insta360 X4 filename format to extract metadata.

Format: IMG_YYYYMMDD_HHMMSS_XX_NNN.insp
        |   |        |      |  |
        |   |        |      |  +-- Sequence number (increments per shot)
        |   |        |      +----- Camera index (00 = front, usually)
        |   |        +------------ Time: HHMMSS
        |   +--------------------- Date: YYYYMMDD
        +------------------------- Prefix (always IMG)

Example: IMG_20260112_182529_00_328.insp
         -> 2026-01-12 18:25:29, camera 0, sequence 328
"""

import re
import logging
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass

logger = logging.getLogger(__name__)

INSTA360_PATTERN = re.compile(
    r"^IMG_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})_(\d{2})_(\d+)\.insp$",
    re.IGNORECASE,
)


@dataclass
class Insta360FileInfo:
    """Parsed information from an Insta360 filename."""

    path: Path
    captured_at: datetime
    camera_index: int
    sequence_number: int


def parse_insta360_filename(path: Path) -> Insta360FileInfo | None:
    """
    Parse Insta360 filename into structured data.
    Returns None if filename doesn't match expected format.
    """
    match = INSTA360_PATTERN.match(path.name)
    if not match:
        return None

    year, month, day, hour, minute, second, cam_idx, seq = match.groups()

    return Insta360FileInfo(
        path=path,
        captured_at=datetime(
            int(year),
            int(month),
            int(day),
            int(hour),
            int(minute),
            int(second),
        ),
        camera_index=int(cam_idx),
        sequence_number=int(seq),
    )


def discover_insp_files(input_dir: Path) -> list[Insta360FileInfo]:
    """
    Discover and sort all .insp files in directory.

    Sorting priority:
    1. Primary: captured_at timestamp
    2. Secondary: sequence_number (handles same-second captures)

    Files that don't match Insta360 format are logged and skipped.
    """
    files: list[Insta360FileInfo] = []

    for path in input_dir.glob("*.insp"):
        info = parse_insta360_filename(path)
        if info:
            files.append(info)
        else:
            logger.warning(f"Skipping non-standard filename: {path.name}")

    # Sort by timestamp, then sequence number
    files.sort(key=lambda f: (f.captured_at, f.sequence_number))

    return files


def discover_gpx_files(input_dir: Path) -> list[Path]:
    """Find GPX files in gpx/ subdirectory or same directory."""
    gpx_dir = input_dir / "gpx"
    if gpx_dir.exists():
        return list(gpx_dir.glob("*.gpx"))
    return list(input_dir.glob("*.gpx"))

"""
Combines all detection layers and merges overlapping regions.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Optional

import numpy as np


class DetectionSource(Enum):
    """Source of a detection."""

    FACE_YOLO_NANO = "face_yolo_n"
    FACE_YOLO_MEDIUM = "face_yolo_m"
    BODY_POSE_HEAD = "body_pose_head"
    LICENSE_PLATE = "plate"


@dataclass
class BlurRegion:
    """A region to blur in an image."""

    x: int  # Center x
    y: int  # Center y
    width: int  # Region width
    height: int  # Region height
    confidence: float  # Detection confidence
    source: DetectionSource


class PrivacyBlurEnsemble:
    """
    Runs all detection layers and merges results.

    This is a placeholder implementation. Full implementation requires
    YOLO models to be downloaded and configured.
    """

    def __init__(self) -> None:
        self._models_loaded = False

    def detect_all(self, image: np.ndarray) -> list[BlurRegion]:
        """
        Run all detectors and return merged blur regions.

        Args:
            image: OpenCV image (BGR format)

        Returns:
            List of BlurRegion objects to blur
        """
        if not self._models_loaded:
            # Return empty list if models not loaded
            return []

        all_regions: list[BlurRegion] = []

        # TODO: Implement actual detection
        # face_regions = self.face_detector.detect(image)
        # body_head_regions = self.body_estimator.detect(image)
        # plate_regions = self.plate_detector.detect(image)
        # all_regions = face_regions + body_head_regions + plate_regions

        # Merge overlapping regions
        merged = self._merge_overlapping(all_regions)

        return merged

    def _merge_overlapping(
        self, regions: list[BlurRegion], iou_threshold: float = 0.3
    ) -> list[BlurRegion]:
        """
        Merge regions that overlap significantly.
        """
        if not regions:
            return []

        # Sort by area (largest first)
        regions = sorted(regions, key=lambda r: r.width * r.height, reverse=True)

        merged: list[BlurRegion] = []
        used: set[int] = set()

        for i, region in enumerate(regions):
            if i in used:
                continue

            # Find all overlapping regions
            cluster = [region]
            for j, other in enumerate(regions[i + 1 :], start=i + 1):
                if j in used:
                    continue
                if self._iou(region, other) > iou_threshold:
                    cluster.append(other)
                    used.add(j)

            # Merge cluster into single region
            merged.append(self._merge_cluster(cluster))
            used.add(i)

        return merged

    def _iou(self, a: BlurRegion, b: BlurRegion) -> float:
        """Calculate Intersection over Union between two regions."""
        a_x1 = a.x - a.width // 2
        a_y1 = a.y - a.height // 2
        a_x2 = a.x + a.width // 2
        a_y2 = a.y + a.height // 2

        b_x1 = b.x - b.width // 2
        b_y1 = b.y - b.height // 2
        b_x2 = b.x + b.width // 2
        b_y2 = b.y + b.height // 2

        # Intersection
        inter_x1 = max(a_x1, b_x1)
        inter_y1 = max(a_y1, b_y1)
        inter_x2 = min(a_x2, b_x2)
        inter_y2 = min(a_y2, b_y2)

        if inter_x2 <= inter_x1 or inter_y2 <= inter_y1:
            return 0.0

        inter_area = (inter_x2 - inter_x1) * (inter_y2 - inter_y1)

        # Union
        a_area = a.width * a.height
        b_area = b.width * b.height
        union_area = a_area + b_area - inter_area

        return inter_area / union_area if union_area > 0 else 0.0

    def _merge_cluster(self, regions: list[BlurRegion]) -> BlurRegion:
        """Merge multiple regions into one encompassing region."""
        min_x = min(r.x - r.width // 2 for r in regions)
        max_x = max(r.x + r.width // 2 for r in regions)
        min_y = min(r.y - r.height // 2 for r in regions)
        max_y = max(r.y + r.height // 2 for r in regions)

        return BlurRegion(
            x=int((min_x + max_x) / 2),
            y=int((min_y + max_y) / 2),
            width=int(max_x - min_x),
            height=int(max_y - min_y),
            confidence=max(r.confidence for r in regions),
            source=regions[0].source,
        )

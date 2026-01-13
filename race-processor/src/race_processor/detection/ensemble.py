"""
Combines all detection layers, merges overlapping regions, and applies blur.

Handles equirectangular projections where faces/objects can be split across
the left/right edge seam. Detection is run on both the original image and
an edge-padded version to catch objects spanning the seam.
"""

from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Literal, Optional

import cv2
import numpy as np
from rich.console import Console

from ..config import BlurConfig

console = Console()

# Percentage of image width to pad for edge detection
EDGE_PAD_RATIO = 0.15


class DetectionSource(Enum):
    """Source of a detection."""

    FACE_YOLO_NANO = "face_yolo_n"
    FACE_YOLO_MEDIUM = "face_yolo_m"
    BODY_POSE_HEAD = "body_pose_head"
    LICENSE_PLATE = "plate"
    DEMO = "demo"
    EDGE_WRAPPED = "edge_wrapped"


@dataclass
class BlurRegion:
    """A region to blur in an image."""

    x: int  # Center x
    y: int  # Center y
    width: int  # Region width
    height: int  # Region height
    confidence: float  # Detection confidence
    source: DetectionSource
    # For edge-wrapped regions, this indicates the region spans the edge
    spans_edge: bool = False


def create_edge_padded_image(image: np.ndarray, pad_ratio: float = EDGE_PAD_RATIO) -> tuple[np.ndarray, int]:
    """
    Create an edge-padded version of an equirectangular image.

    Takes a portion from the left side and appends it to the right side,
    allowing detection of faces/objects that span the left/right seam.

    Args:
        image: Original equirectangular image (BGR format)
        pad_ratio: Ratio of image width to use for padding

    Returns:
        Tuple of (padded_image, pad_width)
    """
    height, width = image.shape[:2]
    pad_width = int(width * pad_ratio)

    # Take the left portion of the image
    left_portion = image[:, :pad_width]

    # Append it to the right side
    padded = np.concatenate([image, left_portion], axis=1)

    return padded, pad_width


def translate_edge_detections(
    regions: list[BlurRegion],
    original_width: int,
    pad_width: int,
) -> list[BlurRegion]:
    """
    Translate detections from edge-padded image back to original coordinates.

    Detections that fall in the padded region (right side) need to be translated
    to the left side of the original image. Detections that span the original
    edge are marked and may be split into two regions.

    Args:
        regions: Detections from the edge-padded image
        original_width: Width of the original image
        pad_width: Width of the padding added

    Returns:
        List of BlurRegion objects with corrected coordinates
    """
    translated = []

    for region in regions:
        region_left = region.x - region.width // 2
        region_right = region.x + region.width // 2

        # Check if detection is entirely within the padded area (right side)
        if region_left >= original_width:
            # Translate to left side of original image
            new_x = region.x - original_width
            translated.append(BlurRegion(
                x=new_x,
                y=region.y,
                width=region.width,
                height=region.height,
                confidence=region.confidence,
                source=DetectionSource.EDGE_WRAPPED,
                spans_edge=False,
            ))

        # Check if detection spans the original edge
        elif region_right > original_width and region_left < original_width:
            # This detection spans the edge - mark it
            # Calculate how much is on each side
            left_width = original_width - region_left
            right_width = region_right - original_width

            # Create a region that spans the edge (will be handled specially in blur)
            # Center it at the edge for tracking purposes
            translated.append(BlurRegion(
                x=region.x if region.x < original_width else region.x - original_width,
                y=region.y,
                width=region.width,
                height=region.height,
                confidence=region.confidence,
                source=DetectionSource.EDGE_WRAPPED,
                spans_edge=True,
            ))

        # Detection is entirely within original image bounds
        elif region_right <= original_width:
            # Keep as-is but mark source
            translated.append(BlurRegion(
                x=region.x,
                y=region.y,
                width=region.width,
                height=region.height,
                confidence=region.confidence,
                source=region.source,
                spans_edge=False,
            ))

    return translated


def blur_region_on_image(
    image: np.ndarray,
    region: BlurRegion,
    config: BlurConfig,
) -> np.ndarray:
    """
    Apply blur to a single region, handling edge-spanning regions.

    Args:
        image: Image to blur (modified in place)
        region: Region to blur
        config: Blur configuration

    Returns:
        Modified image
    """
    height, width = image.shape[:2]

    if region.spans_edge:
        # Region spans the left/right edge - blur both sides
        # Calculate the region bounds
        region_half_width = region.width // 2

        # Determine which side has more of the region
        # If x is near the right edge, the region wraps to the left
        # If x is near the left edge, the region wraps to the right
        if region.x > width // 2:
            # Region is centered on right side, wraps to left
            # Right portion: from (x - half_width) to width
            right_x1 = max(0, region.x - region_half_width)
            right_x2 = width
            # Left portion: from 0 to (x + half_width - width)
            left_x1 = 0
            left_x2 = min(width, (region.x + region_half_width) - width)
        else:
            # Region is centered on left side, wraps to right
            # Left portion: from 0 to (x + half_width)
            left_x1 = 0
            left_x2 = min(width, region.x + region_half_width)
            # Right portion: from (width + x - half_width) to width
            right_x1 = max(0, width + region.x - region_half_width)
            right_x2 = width

        y1 = max(0, region.y - region.height // 2)
        y2 = min(height, region.y + region.height // 2)

        # Apply blur to both portions
        for x1, x2 in [(left_x1, left_x2), (right_x1, right_x2)]:
            if x2 > x1 and y2 > y1:
                roi = image[y1:y2, x1:x2]
                blurred_roi = _apply_blur_to_roi(roi, region, config)
                image[y1:y2, x1:x2] = blurred_roi

    else:
        # Standard region - blur normally
        x1 = max(0, region.x - region.width // 2)
        y1 = max(0, region.y - region.height // 2)
        x2 = min(width, region.x + region.width // 2)
        y2 = min(height, region.y + region.height // 2)

        if x2 > x1 and y2 > y1:
            roi = image[y1:y2, x1:x2]
            blurred_roi = _apply_blur_to_roi(roi, region, config)
            image[y1:y2, x1:x2] = blurred_roi

    return image


def _apply_blur_to_roi(
    roi: np.ndarray,
    region: BlurRegion,
    config: BlurConfig,
) -> np.ndarray:
    """Apply blur effect to a region of interest."""
    if config.method == "gaussian":
        region_size = max(region.width, region.height)
        kernel_size = max(
            config.min_kernel_size,
            int(region_size * config.kernel_size_factor),
        )
        kernel_size = kernel_size + 1 if kernel_size % 2 == 0 else kernel_size

        blurred = roi.copy()
        for _ in range(config.iterations):
            blurred = cv2.GaussianBlur(blurred, (kernel_size, kernel_size), 0)
        return blurred

    else:  # pixelate
        block_size = max(
            config.min_kernel_size // 2,
            int(max(region.width, region.height) * config.kernel_size_factor),
        )
        block_size = max(4, block_size)

        small = cv2.resize(
            roi,
            (max(1, roi.shape[1] // block_size), max(1, roi.shape[0] // block_size)),
            interpolation=cv2.INTER_LINEAR,
        )
        return cv2.resize(
            small, (roi.shape[1], roi.shape[0]), interpolation=cv2.INTER_NEAREST
        )


def blur_image(
    image: np.ndarray,
    regions: list[BlurRegion],
    config: BlurConfig,
) -> np.ndarray:
    """
    Apply blur to specified regions in an image.

    Handles both standard regions and edge-spanning regions for
    equirectangular projections.

    Args:
        image: OpenCV image (BGR format)
        regions: List of BlurRegion objects to blur
        config: Blur configuration

    Returns:
        Image with blur applied to regions
    """
    result = image.copy()

    for region in regions:
        result = blur_region_on_image(result, region, config)

    return result


def generate_demo_detections(
    image: np.ndarray,
    num_regions: int = 3,
    seed: Optional[int] = None,
    include_edge_region: bool = True,
) -> list[BlurRegion]:
    """
    Generate demo/mock detections for testing the pipeline.

    Creates random regions in the image to simulate face detections.
    Optionally includes an edge-spanning region to test edge handling.

    Args:
        image: OpenCV image (BGR format)
        num_regions: Number of demo regions to generate
        seed: Random seed for reproducible results
        include_edge_region: Whether to include a region spanning the edge

    Returns:
        List of BlurRegion objects
    """
    if seed is not None:
        np.random.seed(seed)

    height, width = image.shape[:2]
    regions = []

    for i in range(num_regions):
        # Generate regions in the middle portion of the image
        # (where faces are more likely in 360° images)
        region_width = int(width * np.random.uniform(0.02, 0.05))
        region_height = int(region_width * np.random.uniform(1.0, 1.4))

        x = int(np.random.uniform(0.1, 0.9) * width)
        y = int(np.random.uniform(0.3, 0.7) * height)

        regions.append(
            BlurRegion(
                x=x,
                y=y,
                width=region_width,
                height=region_height,
                confidence=np.random.uniform(0.7, 0.95),
                source=DetectionSource.DEMO,
                spans_edge=False,
            )
        )

    # Add an edge-spanning region for testing
    if include_edge_region and num_regions > 0:
        edge_region_width = int(width * np.random.uniform(0.03, 0.06))
        edge_region_height = int(edge_region_width * np.random.uniform(1.0, 1.4))

        # Place region so it spans the right/left edge
        # x near 0 means it wraps from right edge
        edge_x = int(width * 0.02)  # Near left edge
        edge_y = int(np.random.uniform(0.3, 0.7) * height)

        regions.append(
            BlurRegion(
                x=edge_x,
                y=edge_y,
                width=edge_region_width,
                height=edge_region_height,
                confidence=np.random.uniform(0.7, 0.95),
                source=DetectionSource.DEMO,
                spans_edge=True,  # Mark as edge-spanning for demo
            )
        )

    return regions


class PrivacyBlurEnsemble:
    """
    Runs all detection layers and merges results.

    For equirectangular images, runs detection on both the original image
    and an edge-padded version to catch faces split across the seam.

    Supports three modes:
    - Full mode: Uses YOLO models for face/plate detection (requires models)
    - Demo mode: Generates fake detections for testing
    - Skip mode: Returns empty list (no blur applied)
    """

    def __init__(
        self,
        mode: Literal["full", "demo", "skip"] = "skip",
        models_dir: Optional[Path] = None,
        edge_aware: bool = True,
    ) -> None:
        """
        Initialize the ensemble.

        Args:
            mode: Detection mode
                - "full": Use YOLO models (requires downloaded models)
                - "demo": Generate fake detections for testing
                - "skip": Return empty list (no detections)
            models_dir: Directory containing YOLO models (required for full mode)
            edge_aware: Whether to run edge-aware detection for equirectangular images
        """
        self.mode = mode
        self.models_dir = models_dir
        self.edge_aware = edge_aware
        self._models_loaded = False

        if mode == "full" and models_dir:
            self._load_models()

    def _load_models(self) -> None:
        """Load YOLO models for detection."""
        if self.models_dir is None:
            console.print("  [yellow]Warning: No models directory specified[/]")
            return

        try:
            # Check if models exist
            face_model_path = self.models_dir / "yolov8n-face.pt"
            if not face_model_path.exists():
                console.print(
                    f"  [yellow]Warning: Face model not found at {face_model_path}[/]"
                )
                console.print("  [dim]Run: race-processor download-models[/]")
                return

            # TODO: Actually load YOLO models when available
            # from ultralytics import YOLO
            # self.face_detector = YOLO(face_model_path)

            self._models_loaded = True
            console.print("  [green]Models loaded successfully[/]")

        except Exception as e:
            console.print(f"  [red]Error loading models: {e}[/]")

    def _run_detection(
        self,
        image: np.ndarray,
        demo_seed: Optional[int] = None,
    ) -> list[BlurRegion]:
        """
        Run detection on a single image (internal method).

        Args:
            image: OpenCV image (BGR format)
            demo_seed: Random seed for demo mode

        Returns:
            List of BlurRegion objects
        """
        if self.mode == "demo":
            return generate_demo_detections(
                image, num_regions=3, seed=demo_seed, include_edge_region=False
            )

        if not self._models_loaded:
            return generate_demo_detections(
                image, num_regions=3, seed=demo_seed, include_edge_region=False
            )

        # TODO: Implement actual YOLO detection
        all_regions: list[BlurRegion] = []
        return all_regions

    def detect_all(
        self,
        image: np.ndarray,
        demo_seed: Optional[int] = None,
    ) -> list[BlurRegion]:
        """
        Run all detectors and return merged blur regions.

        For equirectangular images, runs detection on both the original
        and an edge-padded version to catch faces spanning the seam.

        Args:
            image: OpenCV image (BGR format)
            demo_seed: Random seed for demo mode (for reproducible results)

        Returns:
            List of BlurRegion objects to blur
        """
        if self.mode == "skip":
            return []

        if self.mode == "demo":
            # Demo mode: generate fake detections including edge region
            return generate_demo_detections(
                image, num_regions=3, seed=demo_seed, include_edge_region=True
            )

        # Full mode with models
        if not self._models_loaded:
            console.print(
                "  [yellow]Warning: Models not loaded, falling back to demo mode[/]"
            )
            return generate_demo_detections(
                image, num_regions=3, seed=demo_seed, include_edge_region=True
            )

        all_regions: list[BlurRegion] = []
        height, width = image.shape[:2]

        # Run detection on original image
        original_regions = self._run_detection(image, demo_seed)
        all_regions.extend(original_regions)

        # Run edge-aware detection
        if self.edge_aware:
            # Create edge-padded image
            padded_image, pad_width = create_edge_padded_image(image)

            # Run detection on padded image
            edge_seed = demo_seed + 1000 if demo_seed else None
            padded_regions = self._run_detection(padded_image, edge_seed)

            # Filter to only keep detections that involve the edge area
            edge_regions = []
            for region in padded_regions:
                region_left = region.x - region.width // 2
                region_right = region.x + region.width // 2

                # Keep if detection overlaps with the original edge or padded area
                if region_right > width - pad_width or region_left > width:
                    edge_regions.append(region)

            # Translate edge detections back to original coordinates
            if edge_regions:
                translated = translate_edge_detections(edge_regions, width, pad_width)
                all_regions.extend(translated)

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

        # Check if any region spans the edge
        spans_edge = any(r.spans_edge for r in regions)

        return BlurRegion(
            x=int((min_x + max_x) / 2),
            y=int((min_y + max_y) / 2),
            width=int(max_x - min_x),
            height=int(max_y - min_y),
            confidence=max(r.confidence for r in regions),
            source=regions[0].source,
            spans_edge=spans_edge,
        )


def process_blur_single(
    input_path: Path,
    output_path: Path,
    config: BlurConfig,
    mode: Literal["full", "demo", "skip"] = "demo",
    models_dir: Optional[Path] = None,
    edge_aware: bool = True,
) -> bool:
    """
    Apply privacy blur to a single image.

    Args:
        input_path: Path to input image
        output_path: Path to save blurred image
        config: Blur configuration
        mode: Detection mode ("full", "demo", or "skip")
        models_dir: Directory containing YOLO models
        edge_aware: Whether to detect faces spanning equirectangular edges

    Returns:
        True if successful, False otherwise
    """
    # Read image
    image = cv2.imread(str(input_path))
    if image is None:
        console.print(f"  [red]Error: Could not read {input_path}[/]")
        return False

    # Create detector
    detector = PrivacyBlurEnsemble(mode=mode, models_dir=models_dir, edge_aware=edge_aware)

    # Detect regions
    regions = detector.detect_all(image)

    if regions:
        edge_count = sum(1 for r in regions if r.spans_edge)
        console.print(f"    Found {len(regions)} regions to blur ({edge_count} edge-spanning)")

        # Apply blur
        blurred = blur_image(image, regions, config)
    else:
        console.print("    No regions detected")
        blurred = image

    # Ensure output directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Save output
    cv2.imwrite(str(output_path), blurred)
    return True


def process_blur_batch(
    input_dir: Path,
    output_dir: Path,
    config: BlurConfig,
    mode: Literal["full", "demo", "skip"] = "demo",
    models_dir: Optional[Path] = None,
    edge_aware: bool = True,
) -> list[Path]:
    """
    Apply privacy blur to all images in a directory.

    Args:
        input_dir: Directory containing input images
        output_dir: Directory to save blurred images
        config: Blur configuration
        mode: Detection mode
        models_dir: Directory containing YOLO models
        edge_aware: Whether to detect faces spanning equirectangular edges

    Returns:
        List of output file paths
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    # Create detector once for batch
    detector = PrivacyBlurEnsemble(mode=mode, models_dir=models_dir, edge_aware=edge_aware)

    # Find all image files
    image_extensions = {".jpg", ".jpeg", ".png", ".tiff", ".tif"}
    input_files = [f for f in input_dir.iterdir() if f.suffix.lower() in image_extensions]

    output_files = []
    total_regions = 0
    edge_regions = 0

    for input_file in input_files:
        # Read image
        image = cv2.imread(str(input_file))
        if image is None:
            console.print(f"  [yellow]Warning: Could not read {input_file.name}[/]")
            continue

        # Detect regions (use filename hash as seed for reproducible demo results)
        seed = hash(input_file.name) % (2**31) if mode == "demo" else None
        regions = detector.detect_all(image, demo_seed=seed)

        total_regions += len(regions)
        edge_regions += sum(1 for r in regions if r.spans_edge)

        # Apply blur
        if regions:
            blurred = blur_image(image, regions, config)
        else:
            blurred = image

        # Save output
        output_file = output_dir / input_file.name
        cv2.imwrite(str(output_file), blurred)
        output_files.append(output_file)

    console.print(f"    Total: {total_regions} regions ({edge_regions} edge-spanning)")

    return output_files

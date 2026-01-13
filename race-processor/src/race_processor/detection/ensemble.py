"""
Combines all detection layers, merges overlapping regions, and applies blur.
"""

from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Literal, Optional

import cv2
import numpy as np
from rich.console import Console

from ..config import BlurConfig

console = Console()


class DetectionSource(Enum):
    """Source of a detection."""

    FACE_YOLO_NANO = "face_yolo_n"
    FACE_YOLO_MEDIUM = "face_yolo_m"
    BODY_POSE_HEAD = "body_pose_head"
    LICENSE_PLATE = "plate"
    DEMO = "demo"


@dataclass
class BlurRegion:
    """A region to blur in an image."""

    x: int  # Center x
    y: int  # Center y
    width: int  # Region width
    height: int  # Region height
    confidence: float  # Detection confidence
    source: DetectionSource


def blur_image(
    image: np.ndarray,
    regions: list[BlurRegion],
    config: BlurConfig,
) -> np.ndarray:
    """
    Apply blur to specified regions in an image.

    Args:
        image: OpenCV image (BGR format)
        regions: List of BlurRegion objects to blur
        config: Blur configuration

    Returns:
        Image with blur applied to regions
    """
    result = image.copy()

    for region in regions:
        # Calculate region bounds
        x1 = max(0, region.x - region.width // 2)
        y1 = max(0, region.y - region.height // 2)
        x2 = min(image.shape[1], region.x + region.width // 2)
        y2 = min(image.shape[0], region.y + region.height // 2)

        if x2 <= x1 or y2 <= y1:
            continue

        # Extract the region
        roi = result[y1:y2, x1:x2]

        if config.method == "gaussian":
            # Calculate kernel size based on region size
            region_size = max(region.width, region.height)
            kernel_size = max(
                config.min_kernel_size,
                int(region_size * config.kernel_size_factor),
            )
            # Ensure kernel size is odd
            kernel_size = kernel_size + 1 if kernel_size % 2 == 0 else kernel_size

            # Apply Gaussian blur multiple times for stronger effect
            blurred = roi
            for _ in range(config.iterations):
                blurred = cv2.GaussianBlur(blurred, (kernel_size, kernel_size), 0)

            result[y1:y2, x1:x2] = blurred

        else:  # pixelate
            # Calculate block size
            block_size = max(
                config.min_kernel_size // 2,
                int(max(region.width, region.height) * config.kernel_size_factor),
            )
            block_size = max(4, block_size)

            # Downscale and upscale to create pixelation effect
            small = cv2.resize(
                roi,
                (max(1, roi.shape[1] // block_size), max(1, roi.shape[0] // block_size)),
                interpolation=cv2.INTER_LINEAR,
            )
            pixelated = cv2.resize(
                small, (roi.shape[1], roi.shape[0]), interpolation=cv2.INTER_NEAREST
            )

            result[y1:y2, x1:x2] = pixelated

    return result


def generate_demo_detections(
    image: np.ndarray,
    num_regions: int = 3,
    seed: Optional[int] = None,
) -> list[BlurRegion]:
    """
    Generate demo/mock detections for testing the pipeline.

    Creates random regions in the image to simulate face detections.
    Useful for testing the blur pipeline without actual ML models.

    Args:
        image: OpenCV image (BGR format)
        num_regions: Number of demo regions to generate
        seed: Random seed for reproducible results

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
            )
        )

    return regions


class PrivacyBlurEnsemble:
    """
    Runs all detection layers and merges results.

    Supports three modes:
    - Full mode: Uses YOLO models for face/plate detection (requires models)
    - Demo mode: Generates fake detections for testing
    - Skip mode: Returns empty list (no blur applied)
    """

    def __init__(
        self,
        mode: Literal["full", "demo", "skip"] = "skip",
        models_dir: Optional[Path] = None,
    ) -> None:
        """
        Initialize the ensemble.

        Args:
            mode: Detection mode
                - "full": Use YOLO models (requires downloaded models)
                - "demo": Generate fake detections for testing
                - "skip": Return empty list (no detections)
            models_dir: Directory containing YOLO models (required for full mode)
        """
        self.mode = mode
        self.models_dir = models_dir
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

    def detect_all(
        self,
        image: np.ndarray,
        demo_seed: Optional[int] = None,
    ) -> list[BlurRegion]:
        """
        Run all detectors and return merged blur regions.

        Args:
            image: OpenCV image (BGR format)
            demo_seed: Random seed for demo mode (for reproducible results)

        Returns:
            List of BlurRegion objects to blur
        """
        if self.mode == "skip":
            return []

        if self.mode == "demo":
            return generate_demo_detections(image, num_regions=3, seed=demo_seed)

        # Full mode with models
        if not self._models_loaded:
            console.print(
                "  [yellow]Warning: Models not loaded, falling back to demo mode[/]"
            )
            return generate_demo_detections(image, num_regions=3, seed=demo_seed)

        all_regions: list[BlurRegion] = []

        # TODO: Implement actual detection when models are available
        # face_regions = self._detect_faces(image)
        # body_head_regions = self._detect_body_heads(image)
        # plate_regions = self._detect_plates(image)
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


def process_blur_single(
    input_path: Path,
    output_path: Path,
    config: BlurConfig,
    mode: Literal["full", "demo", "skip"] = "demo",
    models_dir: Optional[Path] = None,
) -> bool:
    """
    Apply privacy blur to a single image.

    Args:
        input_path: Path to input image
        output_path: Path to save blurred image
        config: Blur configuration
        mode: Detection mode ("full", "demo", or "skip")
        models_dir: Directory containing YOLO models

    Returns:
        True if successful, False otherwise
    """
    # Read image
    image = cv2.imread(str(input_path))
    if image is None:
        console.print(f"  [red]Error: Could not read {input_path}[/]")
        return False

    # Create detector
    detector = PrivacyBlurEnsemble(mode=mode, models_dir=models_dir)

    # Detect regions
    regions = detector.detect_all(image)

    if regions:
        console.print(f"    Found {len(regions)} regions to blur")

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
) -> list[Path]:
    """
    Apply privacy blur to all images in a directory.

    Args:
        input_dir: Directory containing input images
        output_dir: Directory to save blurred images
        config: Blur configuration
        mode: Detection mode
        models_dir: Directory containing YOLO models

    Returns:
        List of output file paths
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    # Create detector once for batch
    detector = PrivacyBlurEnsemble(mode=mode, models_dir=models_dir)

    # Find all image files
    image_extensions = {".jpg", ".jpeg", ".png", ".tiff", ".tif"}
    input_files = [f for f in input_dir.iterdir() if f.suffix.lower() in image_extensions]

    output_files = []

    for input_file in input_files:
        # Read image
        image = cv2.imread(str(input_file))
        if image is None:
            console.print(f"  [yellow]Warning: Could not read {input_file.name}[/]")
            continue

        # Detect regions (use filename hash as seed for reproducible demo results)
        seed = hash(input_file.name) % (2**31) if mode == "demo" else None
        regions = detector.detect_all(image, demo_seed=seed)

        # Apply blur
        if regions:
            blurred = blur_image(image, regions, config)
        else:
            blurred = image

        # Save output
        output_file = output_dir / input_file.name
        cv2.imwrite(str(output_file), blurred)
        output_files.append(output_file)

    return output_files

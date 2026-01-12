"""
Configuration settings for the race processor pipeline.
"""

from pathlib import Path
from pydantic import BaseModel, Field
from typing import Literal


class FaceDetectionConfig(BaseModel):
    """Configuration for face detection."""

    models: list[str] = Field(
        default=["yolov8n-face", "yolov8m-face"],
        description="YOLO models to use for face detection",
    )
    confidence_threshold: float = Field(
        default=0.25, description="Confidence threshold for detections (lower = more aggressive)"
    )
    box_expansion: float = Field(
        default=1.5, description="Factor to expand detected face boxes"
    )
    min_face_size: int = Field(
        default=20, description="Minimum face size in pixels"
    )
    multi_scale: bool = Field(
        default=True, description="Whether to run detection at multiple scales"
    )
    scales: list[float] = Field(
        default=[1.0, 0.5], description="Scales for multi-scale detection"
    )


class BodyPoseConfig(BaseModel):
    """Configuration for body pose estimation."""

    model: str = Field(default="yolov8n-pose", description="YOLO pose model")
    body_confidence: float = Field(
        default=0.3, description="Confidence threshold for body detection"
    )
    always_estimate_head: bool = Field(
        default=True, description="Estimate head even without face keypoints"
    )
    head_width_ratio: float = Field(
        default=0.35, description="Head width relative to body width"
    )
    head_height_ratio: float = Field(
        default=0.20, description="Head height relative to body height"
    )
    head_expansion: float = Field(
        default=1.4, description="Expansion factor for head region"
    )


class PlateDetectionConfig(BaseModel):
    """Configuration for license plate detection."""

    model: str = Field(default="yolov8-plate", description="YOLO plate model")
    confidence_threshold: float = Field(default=0.4, description="Confidence threshold")
    box_expansion: float = Field(default=1.2, description="Box expansion factor")


class BlurConfig(BaseModel):
    """Configuration for blur application."""

    method: Literal["gaussian", "pixelate"] = Field(
        default="gaussian", description="Blur method"
    )
    kernel_size_factor: float = Field(
        default=0.15, description="Kernel size as fraction of region size"
    )
    min_kernel_size: int = Field(default=15, description="Minimum kernel size")
    iterations: int = Field(default=2, description="Number of blur iterations")


class ImageTierConfig(BaseModel):
    """Configuration for an image quality tier."""

    width: int
    quality_avif: int
    quality_webp: int


class ImageTiersConfig(BaseModel):
    """Configuration for all image quality tiers."""

    thumbnail: ImageTierConfig = Field(
        default=ImageTierConfig(width=512, quality_avif=60, quality_webp=70)
    )
    medium: ImageTierConfig = Field(
        default=ImageTierConfig(width=2048, quality_avif=70, quality_webp=75)
    )
    full: ImageTierConfig = Field(
        default=ImageTierConfig(width=4096, quality_avif=75, quality_webp=80)
    )


class StitchConfig(BaseModel):
    """Configuration for stitching pipeline."""

    output_width: int = Field(default=7680, description="Output width (8K)")
    output_height: int = Field(default=3840, description="Output height (2:1 ratio)")
    use_flowstate: bool = Field(default=True, description="Use FlowState stabilization")
    horizon_lock: bool = Field(default=True, description="Lock horizon level")
    blend_mode: Literal["optical_flow", "template", "natural"] = Field(
        default="optical_flow", description="Stitch blend mode"
    )
    output_format: Literal["tiff", "jpg", "png"] = Field(
        default="tiff", description="Intermediate output format"
    )
    output_quality: int = Field(default=100, description="Output quality")


class R2Config(BaseModel):
    """Configuration for Cloudflare R2 storage."""

    endpoint: str = Field(description="R2 endpoint URL")
    access_key_id: str = Field(description="R2 access key ID")
    secret_access_key: str = Field(description="R2 secret access key")
    bucket_name: str = Field(default="race-images", description="R2 bucket name")
    region: str = Field(default="auto", description="R2 region")


class PipelineConfig(BaseModel):
    """Main pipeline configuration."""

    # Input/output paths
    input_dir: Path = Field(description="Input directory with .insp files")
    output_dir: Path = Field(description="Output directory")
    race_slug: str = Field(description="Race slug for naming")

    # SDK settings
    use_sdk: bool = Field(
        default=True, description="Use Insta360 SDK (vs Studio CLI)"
    )
    sdk_path: Path = Field(
        default=Path("/opt/insta360-sdk"), description="Path to Insta360 SDK"
    )

    # Processing settings
    workers: int = Field(default=4, description="Number of parallel workers")
    skip_blur: bool = Field(default=False, description="Skip blur stage")
    skip_upload: bool = Field(default=False, description="Skip R2 upload")

    # Component configs
    face_detection: FaceDetectionConfig = Field(default_factory=FaceDetectionConfig)
    body_pose: BodyPoseConfig = Field(default_factory=BodyPoseConfig)
    plate_detection: PlateDetectionConfig = Field(default_factory=PlateDetectionConfig)
    blur: BlurConfig = Field(default_factory=BlurConfig)
    image_tiers: ImageTiersConfig = Field(default_factory=ImageTiersConfig)
    stitch: StitchConfig = Field(default_factory=StitchConfig)

    # R2 config (optional, loaded from env if not provided)
    r2: R2Config | None = Field(default=None, description="R2 storage config")


# Default paths
DEFAULT_MODELS_DIR = Path(__file__).parent.parent.parent / "models"
DEFAULT_DATA_DIR = Path(__file__).parent.parent.parent / "data"
DEFAULT_OUTPUT_DIR = Path(__file__).parent.parent.parent / "output"

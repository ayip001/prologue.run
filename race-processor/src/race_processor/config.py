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
        default=0.25, description="Kernel size as fraction of region size"
    )
    min_kernel_size: int = Field(default=25, description="Minimum kernel size")
    iterations: int = Field(default=3, description="Number of blur iterations")


class ImageTierConfig(BaseModel):
    """Configuration for an image quality tier."""

    width: int
    avif_quality: int
    webp_quality: int


class ImageTiersConfig(BaseModel):
    """Configuration for all image quality tiers."""

    thumbnail: ImageTierConfig = Field(
        default=ImageTierConfig(width=512, avif_quality=60, webp_quality=70)
    )
    medium: ImageTierConfig = Field(
        default=ImageTierConfig(width=2048, avif_quality=70, webp_quality=75)
    )
    full: ImageTierConfig = Field(
        default=ImageTierConfig(width=4096, avif_quality=75, webp_quality=80)
    )


class CopyrightConfig(BaseModel):
    """Configuration for copyright watermark."""

    text: str = Field(
        default="© {year} Prologue.run",
        description="Copyright text template. {year} will be replaced with current year",
    )
    font_size_ratio: float = Field(
        default=0.012,
        description="Font size as ratio of image height",
    )
    font_color: tuple[int, int, int, int] = Field(
        default=(255, 255, 255, 180),
        description="RGBA color for text",
    )
    shadow_color: tuple[int, int, int, int] = Field(
        default=(0, 0, 0, 120),
        description="RGBA color for text shadow",
    )
    shadow_offset: int = Field(
        default=2,
        description="Shadow offset in pixels",
    )
    position: Literal["bottom-left", "bottom-center", "bottom-right"] = Field(
        default="bottom-left",
        description="Position of copyright text",
    )
    margin_ratio: float = Field(
        default=0.015,
        description="Margin from edge as ratio of image dimension",
    )


class DebugConfig(BaseModel):
    """Configuration for debug mode with intermediate output."""

    enabled: bool = Field(
        default=False,
        description="Enable debug mode to save intermediate files",
    )
    output_format: Literal["jpg", "png", "tiff"] = Field(
        default="jpg",
        description="Format for debug output images",
    )
    output_quality: int = Field(
        default=90,
        description="Quality for debug output images (for jpg)",
    )


class StepControlConfig(BaseModel):
    """Configuration for controlling which pipeline steps to run."""

    # Step numbers: 1=Intake, 2=Blur, 3=Watermark, 4=Resize, 5=Export, 6=Upload
    start_step: int = Field(
        default=1,
        ge=1,
        le=6,
        description="Start processing from this step (1-6)",
    )
    end_step: int = Field(
        default=6,
        ge=1,
        le=6,
        description="Stop processing after this step (1-6)",
    )
    single_image: str | None = Field(
        default=None,
        description="Process only this specific image filename",
    )


class R2Config(BaseModel):
    """Configuration for Cloudflare R2 storage."""

    endpoint: str = Field(description="R2 endpoint URL")
    access_key_id: str = Field(description="R2 access key ID")
    secret_access_key: str = Field(description="R2 secret access key")
    bucket: str = Field(default="race-images", description="R2 bucket name")
    region: str = Field(default="auto", description="R2 region")


class PipelineConfig(BaseModel):
    """Main pipeline configuration."""

    # Input/output paths
    input_dir: Path = Field(description="Input directory with equirectangular images")
    output_dir: Path = Field(description="Output directory")
    race_slug: str = Field(description="Race slug for naming")

    # Processing settings
    workers: int = Field(default=4, description="Number of parallel workers")
    skip_blur: bool = Field(default=False, description="Skip blur stage")
    skip_upload: bool = Field(default=True, description="Skip R2 upload (default: True)")
    upload_prefix: str | None = Field(
        default=None, 
        description="Override R2 storage prefix (default: races/{race_slug})"
    )

    # Component configs
    face_detection: FaceDetectionConfig = Field(default_factory=FaceDetectionConfig)
    body_pose: BodyPoseConfig = Field(default_factory=BodyPoseConfig)
    plate_detection: PlateDetectionConfig = Field(default_factory=PlateDetectionConfig)
    blur: BlurConfig = Field(default_factory=BlurConfig)
    image_tiers: ImageTiersConfig = Field(default_factory=ImageTiersConfig)
    copyright: CopyrightConfig = Field(default_factory=CopyrightConfig)

    # Debug and step control
    debug: DebugConfig = Field(default_factory=DebugConfig)
    step_control: StepControlConfig = Field(default_factory=StepControlConfig)

    # R2 config (optional, loaded from env if not provided)
    r2: R2Config | None = Field(default=None, description="R2 storage config")


# Default paths
DEFAULT_MODELS_DIR = Path(__file__).parent.parent.parent / "models"
DEFAULT_DATA_DIR = Path(__file__).parent.parent.parent / "data"
DEFAULT_OUTPUT_DIR = Path(__file__).parent.parent.parent / "output"

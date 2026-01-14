"""
Main pipeline orchestrator that coordinates all processing stages.

Simplified Pipeline Steps:
    1. Intake    - Import images, extract EXIF, sort by timestamp, rename sequentially
    2. Blur      - Apply privacy blurring (faces, plates)
    3. Watermark - Add copyright text overlay
    4. Resize    - Generate quality tiers (thumbnail, medium, full)
    5. Export    - Encode to AVIF/WebP formats
    6. Upload    - Privacy check, upload to R2, generate DB records

Debug mode saves intermediate images after each step for inspection.
Direct mode (--src/--dst) allows testing individual steps on arbitrary images.
"""

from datetime import datetime
from enum import IntEnum
from pathlib import Path
from typing import Literal, Optional
import shutil

import cv2
from rich.console import Console
from rich.table import Table

from ..config import (
    PipelineConfig,
    DebugConfig,
    BlurConfig,
    CopyrightConfig,
    ImageTiersConfig,
    DEFAULT_MODELS_DIR,
)
from .intake import run_intake, load_manifest, IntakeManifest
from .watermark import add_copyright_watermark, process_single_image as watermark_single
from .export import run_export
from .upload import run_upload, run_privacy_check
from ..detection.ensemble import (
    PrivacyBlurEnsemble,
    blur_image,
    process_blur_single,
    process_blur_batch,
)

console = Console()


class PipelineStep(IntEnum):
    """Pipeline step numbers for step control."""

    INTAKE = 1
    BLUR = 2
    WATERMARK = 3
    RESIZE = 4
    EXPORT = 5
    UPLOAD = 6


STEP_NAMES = {
    PipelineStep.INTAKE: "Intake",
    PipelineStep.BLUR: "Blur",
    PipelineStep.WATERMARK: "Watermark",
    PipelineStep.RESIZE: "Resize",
    PipelineStep.EXPORT: "Export",
    PipelineStep.UPLOAD: "Upload",
}


def should_run_step(step: PipelineStep, config: PipelineConfig) -> bool:
    """Check if a step should run based on step control configuration."""
    return config.step_control.start_step <= step <= config.step_control.end_step


def save_debug_image(
    image_path: Path,
    step: PipelineStep,
    output_base: Path,
    debug_config: DebugConfig,
    image_name: Optional[str] = None,
) -> Path:
    """
    Save an intermediate image for debugging.

    Args:
        image_path: Path to the source image
        step: Current pipeline step
        output_base: Base output directory
        debug_config: Debug configuration
        image_name: Optional name for the output (defaults to source filename)

    Returns:
        Path to the saved debug image
    """
    if not debug_config.enabled:
        return image_path

    step_name = STEP_NAMES[step].lower()
    debug_dir = output_base / "debug" / f"step{step.value}_{step_name}"
    debug_dir.mkdir(parents=True, exist_ok=True)

    if image_name is None:
        image_name = image_path.stem

    output_ext = f".{debug_config.output_format}"
    output_path = debug_dir / f"{image_name}{output_ext}"

    # Read and save with configured format/quality
    image = cv2.imread(str(image_path))
    if image is not None:
        if debug_config.output_format == "jpg":
            cv2.imwrite(
                str(output_path),
                image,
                [cv2.IMWRITE_JPEG_QUALITY, debug_config.output_quality],
            )
        elif debug_config.output_format == "png":
            cv2.imwrite(str(output_path), image)
        else:  # tiff
            cv2.imwrite(str(output_path), image)

        console.print(f"    [dim]Debug: saved {output_path.name}[/]")

    return output_path


def save_debug_image_from_array(
    image: "cv2.typing.MatLike",
    step: PipelineStep,
    output_base: Path,
    debug_config: DebugConfig,
    image_name: str,
) -> Optional[Path]:
    """
    Save an image array for debugging.

    Args:
        image: Image as numpy array (BGR format)
        step: Current pipeline step
        output_base: Base output directory
        debug_config: Debug configuration
        image_name: Name for the output file (without extension)

    Returns:
        Path to the saved debug image, or None if debug is disabled
    """
    if not debug_config.enabled:
        return None

    step_name = STEP_NAMES[step].lower()
    debug_dir = output_base / "debug" / f"step{step.value}_{step_name}"
    debug_dir.mkdir(parents=True, exist_ok=True)

    output_ext = f".{debug_config.output_format}"
    output_path = debug_dir / f"{image_name}{output_ext}"

    if debug_config.output_format == "jpg":
        cv2.imwrite(
            str(output_path),
            image,
            [cv2.IMWRITE_JPEG_QUALITY, debug_config.output_quality],
        )
    elif debug_config.output_format == "png":
        cv2.imwrite(str(output_path), image)
    else:  # tiff
        cv2.imwrite(str(output_path), image)

    console.print(f"    [dim]Debug: saved {output_path.name}[/]")
    return output_path


def print_step_summary(config: PipelineConfig, blur_mode: str = "full") -> None:
    """Print a summary of which steps will run."""
    table = Table(title="Pipeline Steps")
    table.add_column("Step", style="cyan")
    table.add_column("Name", style="white")
    table.add_column("Status", style="green")

    for step in PipelineStep:
        step_name = STEP_NAMES[step]
        if should_run_step(step, config):
            if step == PipelineStep.BLUR:
                if config.skip_blur:
                    status = "[yellow]Skipped (--skip-blur)[/]"
                else:
                    status = f"[green]Will run ({blur_mode} mode)[/]"
            elif step == PipelineStep.UPLOAD:
                if config.skip_upload:
                    status = "[yellow]Skipped (default)[/]"
                else:
                    status = "[green]Will run[/]"
            else:
                status = "[green]Will run[/]"
        else:
            status = "[dim]Skipped (step control)[/]"

        table.add_row(str(step.value), step_name, status)

    console.print(table)

    if config.debug.enabled:
        console.print(
            f"\n[bold yellow]Debug mode enabled[/] - "
            f"Intermediate images will be saved as {config.debug.output_format.upper()}"
        )

    if config.step_control.single_image:
        console.print(
            f"\n[bold cyan]Single image mode:[/] {config.step_control.single_image}"
        )

    console.print()


def get_image_files(directory: Path) -> list[Path]:
    """Get all image files from a directory."""
    extensions = {".jpg", ".jpeg", ".png", ".tiff", ".tif"}
    return sorted([f for f in directory.iterdir() if f.suffix.lower() in extensions])


def run_direct_processing(
    src: Path,
    dst: Path,
    start_step: int,
    end_step: int,
    blur_mode: str = "full",
    blur_conf: float = 0.12,
    debug: bool = False,
    debug_format: str = "jpg",
    single_image: Optional[str] = None,
    copyright_text: Optional[str] = None,
) -> None:
    """
    Run direct processing on arbitrary images without the full pipeline structure.

    This mode bypasses the standard directory structure and processes images
    directly from --src to --dst, useful for testing individual steps.

    Args:
        src: Source directory or file
        dst: Destination directory
        start_step: Starting step number (1-6)
        end_step: Ending step number (1-6)
        blur_mode: Blur detection mode ("full", "skip")
        blur_conf: Confidence threshold for blur detection
        debug: Enable debug output
        debug_format: Format for debug images
        single_image: Process only this specific filename
        copyright_text: Custom copyright text
    """
    # Ensure destination exists
    dst.mkdir(parents=True, exist_ok=True)

    # Create debug directory if needed
    debug_dir = dst / "debug" if debug else None
    if debug_dir:
        debug_dir.mkdir(exist_ok=True)

    debug_config = DebugConfig(enabled=debug, output_format=debug_format)

    # Determine source files
    if src.is_file():
        source_files = [src]
    else:
        source_files = get_image_files(src)
        if single_image:
            source_files = [f for f in source_files if f.name == single_image]
            if not source_files:
                console.print(f"[red]Error: '{single_image}' not found in {src}[/]")
                return

    if not source_files:
        console.print(f"[red]Error: No image files found in {src}[/]")
        return

    console.print(f"\n  Found {len(source_files)} image(s) to process")

    # Track current working files (start with source files)
    current_files = {f.name: f for f in source_files}

    # Process each step
    for step_num in range(start_step, end_step + 1):
        step = PipelineStep(step_num)
        step_name = STEP_NAMES[step]

        console.print(f"\n[bold]Step {step_num}: {step_name}[/]")

        # Create step output directory
        step_output = dst / f"step{step_num}_{step_name.lower()}"
        step_output.mkdir(exist_ok=True)

        if step == PipelineStep.INTAKE:
            console.print("  [dim]Skipping in direct mode (use full pipeline for intake)[/]")
            continue

        elif step == PipelineStep.BLUR:
            console.print(f"  Mode: {blur_mode} (conf: {blur_conf})")
            blur_config = BlurConfig()

            processed = 0
            for name, path in current_files.items():
                output_path = step_output / name
                success = process_blur_single(
                    path,
                    output_path,
                    blur_config,
                    mode=blur_mode,
                    models_dir=DEFAULT_MODELS_DIR,
                    conf_threshold=blur_conf,
                )
                if success:
                    current_files[name] = output_path
                    processed += 1

                    if debug:
                        save_debug_image(output_path, step, dst, debug_config)

            console.print(f"  [green]Processed {processed} images[/]")

        elif step == PipelineStep.WATERMARK:
            copyright_config = CopyrightConfig()
            if copyright_text:
                copyright_config = CopyrightConfig(text=copyright_text)

            year = datetime.now().year
            console.print(f"  Text: {copyright_config.text.format(year=year)}")

            processed = 0
            for name, path in current_files.items():
                output_path = step_output / name
                success = watermark_single(path, output_path, copyright_config)
                if success:
                    current_files[name] = output_path
                    processed += 1

                    if debug:
                        save_debug_image(output_path, step, dst, debug_config)

            console.print(f"  [green]Watermarked {processed} images[/]")

        elif step == PipelineStep.RESIZE:
            tier_config = ImageTiersConfig()

            # Create tier subdirectories
            for tier in ["thumbnail", "medium", "full"]:
                (step_output / tier).mkdir(exist_ok=True)

            tiers = {
                "thumbnail": tier_config.thumbnail,
                "medium": tier_config.medium,
                "full": tier_config.full,
            }

            processed = 0
            for name, path in current_files.items():
                image = cv2.imread(str(path))
                if image is None:
                    continue

                height, width = image.shape[:2]

                for tier_name, tier in tiers.items():
                    new_width = tier.width
                    new_height = int(height * (new_width / width))

                    resized = cv2.resize(
                        image, (new_width, new_height), interpolation=cv2.INTER_LANCZOS4
                    )

                    tier_output = step_output / tier_name / name
                    cv2.imwrite(str(tier_output), resized)

                    if debug:
                        debug_name = f"{Path(name).stem}_{tier_name}"
                        save_debug_image_from_array(resized, step, dst, debug_config, debug_name)

                # Update current_files to point to full resolution
                current_files[name] = step_output / "full" / name
                processed += 1

            console.print(
                f"  [green]Resized {processed} images to 3 tiers: "
                f"{tier_config.thumbnail.width}px, "
                f"{tier_config.medium.width}px, "
                f"{tier_config.full.width}px[/]"
            )

        elif step == PipelineStep.EXPORT:
            console.print("  [dim]Export requires full pipeline structure[/]")
            # Copy files to step output
            for name, path in current_files.items():
                shutil.copy(path, step_output / name)
                current_files[name] = step_output / name

        elif step == PipelineStep.UPLOAD:
            console.print("  [dim]Skipping in direct mode (no R2 config)[/]")
            continue

    # Summary
    console.print(f"\n[bold green]Direct processing complete![/]")
    console.print(f"  Output: {dst}")

    # List output directories
    output_dirs = [d for d in dst.iterdir() if d.is_dir()]
    for d in sorted(output_dirs):
        if d.name == "debug":
            continue
        file_count = len(list(d.rglob("*")) if d.is_dir() else [])
        console.print(f"    - {d.name}/: {file_count} files")


def run_pipeline(
    config: PipelineConfig,
    blur_mode: Literal["full", "skip"] = "full",
    blur_conf: float = 0.12,
) -> None:
    """
    Run the processing pipeline with step control and debug output.

    Simplified 6-Step Pipeline:
    1. Intake - Import images, extract EXIF, sort by timestamp, rename sequentially
    2. Blur - Apply privacy blurring
    3. Watermark - Add copyright text
    4. Resize - Generate quality tiers
    5. Export - Encode to AVIF/WebP
    6. Upload - Privacy check, upload to R2, generate DB records
    """
    console.print("[bold blue]Starting pipeline...[/]")

    # Print step summary
    print_step_summary(config, blur_mode)

    # Create output directories
    output_base = config.output_dir / config.race_slug
    output_base.mkdir(parents=True, exist_ok=True)

    dirs = {
        "intake": output_base / "intake",
        "blurred": output_base / "blurred",
        "watermarked": output_base / "watermarked",
        "resized": output_base / "resized",
        "final": output_base / "final",
    }
    for d in dirs.values():
        d.mkdir(exist_ok=True)

    # Create debug directory if needed
    if config.debug.enabled:
        (output_base / "debug").mkdir(exist_ok=True)

    manifest: Optional[IntakeManifest] = None

    # =========================================================================
    # Stage 1: Intake
    # =========================================================================
    if should_run_step(PipelineStep.INTAKE, config):
        console.print("\n[bold]Stage 1: Intake[/]")

        manifest = run_intake(
            config.input_dir,
            dirs["intake"],
            config.race_slug,
        )

        if not manifest:
            console.print("  [red]Intake failed - no images found[/]")
            return

        # Filter to single image if specified
        if config.step_control.single_image:
            console.print(f"  [cyan]Single image mode: {config.step_control.single_image}[/]")
            # Find the matching image in intake
            matching = [
                img for img in manifest.images
                if img.original_filename == config.step_control.single_image
            ]
            if matching:
                manifest.images = matching
                console.print(f"  Filtered to 1 image")
            else:
                console.print(f"  [yellow]Warning: Image not found, processing all[/]")

        console.print(f"  [green]Intake complete: {manifest.total_images} images[/]")
    else:
        console.print("\n[dim]Stage 1: Intake - Skipped (step control)[/]")
        # Try to load existing manifest
        manifest = load_manifest(dirs["intake"])
        if manifest:
            console.print(f"  [dim]Loaded existing manifest: {manifest.total_images} images[/]")

    # =========================================================================
    # Stage 2: Blur
    # =========================================================================
    if should_run_step(PipelineStep.BLUR, config):
        console.print("\n[bold]Stage 2: Blur[/]")

        source_images = get_image_files(dirs["intake"])

        if config.skip_blur:
            console.print("  [yellow]Skipping - --skip-blur flag set[/]")
            for img in source_images:
                shutil.copy(img, dirs["blurred"] / img.name)
            console.print(f"  Copied {len(source_images)} images to blurred/")

        elif blur_mode == "skip":
            console.print("  [yellow]Skipping - --blur-mode skip[/]")
            for img in source_images:
                shutil.copy(img, dirs["blurred"] / img.name)
            console.print(f"  Copied {len(source_images)} images to blurred/")

        elif source_images:
            console.print(f"  Mode: {blur_mode} (conf: {blur_conf})")
            console.print(f"  Processing {len(source_images)} images...")

            output_files = process_blur_batch(
                dirs["intake"],
                dirs["blurred"],
                config.blur,
                mode=blur_mode,
                models_dir=DEFAULT_MODELS_DIR,
                conf_threshold=blur_conf,
            )
            console.print(f"  [green]Blurred {len(output_files)} images[/]")

        else:
            console.print("  [yellow]No source images found in intake/[/]")

        # Debug output
        if config.debug.enabled:
            blurred_images = get_image_files(dirs["blurred"])
            for img in blurred_images[:5]:
                save_debug_image(img, PipelineStep.BLUR, output_base, config.debug)
    else:
        console.print("\n[dim]Stage 2: Blur - Skipped (step control)[/]")

    # =========================================================================
    # Stage 3: Watermark
    # =========================================================================
    if should_run_step(PipelineStep.WATERMARK, config):
        console.print("\n[bold]Stage 3: Watermark[/]")

        # Get source images from blurred directory (or intake if blur was skipped)
        source_dir = dirs["blurred"] if get_image_files(dirs["blurred"]) else dirs["intake"]
        source_images = get_image_files(source_dir)

        if source_images:
            year = datetime.now().year
            console.print(f"  Processing {len(source_images)} images...")
            console.print(f"  Copyright text: {config.copyright.text.format(year=year)}")

            processed_count = 0
            for img_path in source_images:
                output_path = dirs["watermarked"] / img_path.name
                success = watermark_single(
                    img_path, output_path, config.copyright
                )
                if success:
                    processed_count += 1

                    # Save debug output
                    if config.debug.enabled:
                        image = cv2.imread(str(output_path))
                        if image is not None:
                            save_debug_image_from_array(
                                image,
                                PipelineStep.WATERMARK,
                                output_base,
                                config.debug,
                                img_path.stem,
                            )

            console.print(f"  [green]Watermarked {processed_count} images[/]")
        else:
            console.print("  [yellow]No source images found[/]")
            console.print(f"  Expected images in: {source_dir}")
    else:
        console.print("\n[dim]Stage 3: Watermark - Skipped (step control)[/]")

    # =========================================================================
    # Stage 4: Resize
    # =========================================================================
    if should_run_step(PipelineStep.RESIZE, config):
        console.print("\n[bold]Stage 4: Resize[/]")

        # Get source images from watermarked directory
        source_dir = dirs["watermarked"]
        if not get_image_files(source_dir):
            source_dir = dirs["blurred"]
        if not get_image_files(source_dir):
            source_dir = dirs["intake"]

        source_images = get_image_files(source_dir)

        if source_images:
            console.print(f"  Processing {len(source_images)} images...")

            # Create tier directories
            for tier_name in ["thumbnail", "medium", "full"]:
                (dirs["resized"] / tier_name).mkdir(exist_ok=True)

            tier_configs = {
                "thumbnail": config.image_tiers.thumbnail,
                "medium": config.image_tiers.medium,
                "full": config.image_tiers.full,
            }

            for img_path in source_images:
                image = cv2.imread(str(img_path))
                if image is None:
                    continue

                height, width = image.shape[:2]

                for tier_name, tier_config in tier_configs.items():
                    # Calculate new dimensions maintaining aspect ratio
                    new_width = tier_config.width
                    new_height = int(height * (new_width / width))

                    resized = cv2.resize(
                        image, (new_width, new_height), interpolation=cv2.INTER_LANCZOS4
                    )

                    output_path = dirs["resized"] / tier_name / img_path.name
                    cv2.imwrite(str(output_path), resized)

                    # Debug output for each tier
                    if config.debug.enabled:
                        debug_name = f"{img_path.stem}_{tier_name}"
                        save_debug_image_from_array(
                            resized,
                            PipelineStep.RESIZE,
                            output_base,
                            config.debug,
                            debug_name,
                        )

            console.print(
                f"  [green]Resized to 3 tiers: "
                f"{config.image_tiers.thumbnail.width}px, "
                f"{config.image_tiers.medium.width}px, "
                f"{config.image_tiers.full.width}px[/]"
            )
        else:
            console.print("  [yellow]No source images found[/]")
    else:
        console.print("\n[dim]Stage 4: Resize - Skipped (step control)[/]")

    # =========================================================================
    # Stage 5: Export
    # =========================================================================
    if should_run_step(PipelineStep.EXPORT, config):
        console.print("\n[bold]Stage 5: Export[/]")

        # Check for resized images
        has_resized = any(
            get_image_files(dirs["resized"] / tier)
            for tier in ["thumbnail", "medium", "full"]
        )

        if has_resized:
            run_export(output_base, output_base, config.image_tiers)
        else:
            console.print("  [yellow]No resized images found[/]")
    else:
        console.print("\n[dim]Stage 5: Export - Skipped (step control)[/]")

    # =========================================================================
    # Stage 6: Upload
    # =========================================================================
    if should_run_step(PipelineStep.UPLOAD, config):
        console.print("\n[bold]Stage 6: Upload[/]")

        success = run_upload(
            output_base,
            config.r2,
            config.race_slug,
            skip_upload=config.skip_upload,
            upload_prefix=config.upload_prefix,
        )

        if success:
            console.print("  [green]Upload step complete[/]")
        else:
            console.print("  [red]Upload step failed[/]")
    else:
        console.print("\n[dim]Stage 6: Upload - Skipped (step control)[/]")

    # =========================================================================
    # Summary
    # =========================================================================
    console.print("\n[bold green]Pipeline complete![/]")
    console.print(f"  Output: {output_base}")

    if config.debug.enabled:
        debug_dir = output_base / "debug"
        if debug_dir.exists():
            debug_folders = [d for d in debug_dir.iterdir() if d.is_dir()]
            console.print(f"  Debug output: {debug_dir}")
            for folder in sorted(debug_folders):
                file_count = len(list(folder.glob("*")))
                console.print(f"    - {folder.name}: {file_count} files")

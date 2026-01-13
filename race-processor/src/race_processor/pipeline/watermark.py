"""
Applies copyright watermark to equirectangular images.
Similar to how Google Street View adds "(c) Google Maps [year]" to each viewpoint.
"""

from datetime import datetime
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from rich.console import Console

from ..config import CopyrightConfig

console = Console()


def get_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    """
    Get a font for rendering text. Tries to find a good sans-serif font,
    falls back to default if none available.
    """
    # Common sans-serif fonts to try (in order of preference)
    font_paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
        "/usr/share/fonts/TTF/DejaVuSans.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/SFNSText.ttf",
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/segoeui.ttf",
    ]

    for font_path in font_paths:
        try:
            return ImageFont.truetype(font_path, size)
        except (OSError, IOError):
            continue

    # Fall back to default font (will be small but functional)
    console.print("  [yellow]Warning: Using default font (no TrueType fonts found)[/]")
    return ImageFont.load_default()


def add_copyright_watermark(
    image: np.ndarray,
    config: CopyrightConfig,
    year: Optional[int] = None,
) -> np.ndarray:
    """
    Add a copyright watermark to an equirectangular image.

    Args:
        image: Input image as numpy array (BGR format from OpenCV)
        config: Copyright configuration
        year: Year to use in copyright text (defaults to current year)

    Returns:
        Image with copyright watermark applied
    """
    if year is None:
        year = datetime.now().year

    # Format the copyright text
    text = config.text.format(year=year)

    # Get image dimensions
    height, width = image.shape[:2]

    # Calculate font size based on image height
    font_size = max(12, int(height * config.font_size_ratio))

    # Convert from BGR to RGB for PIL
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    # Create PIL Image
    pil_image = Image.fromarray(image_rgb)

    # Create a transparent overlay for the text
    overlay = Image.new("RGBA", pil_image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    # Get font
    font = get_font(font_size)

    # Get text bounding box
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    # Calculate position
    margin_x = int(width * config.margin_ratio)
    margin_y = int(height * config.margin_ratio)

    if config.position == "bottom-left":
        x = margin_x
        y = height - margin_y - text_height
    elif config.position == "bottom-center":
        x = (width - text_width) // 2
        y = height - margin_y - text_height
    else:  # bottom-right
        x = width - margin_x - text_width
        y = height - margin_y - text_height

    # Draw shadow first
    shadow_offset = config.shadow_offset
    draw.text(
        (x + shadow_offset, y + shadow_offset),
        text,
        font=font,
        fill=config.shadow_color,
    )

    # Draw main text
    draw.text(
        (x, y),
        text,
        font=font,
        fill=config.font_color,
    )

    # Composite the overlay onto the image
    pil_image = pil_image.convert("RGBA")
    pil_image = Image.alpha_composite(pil_image, overlay)

    # Convert back to RGB then BGR for OpenCV
    result_rgb = pil_image.convert("RGB")
    result_bgr = cv2.cvtColor(np.array(result_rgb), cv2.COLOR_RGB2BGR)

    return result_bgr


def process_watermark_batch(
    input_dir: Path,
    output_dir: Path,
    config: CopyrightConfig,
    year: Optional[int] = None,
) -> list[Path]:
    """
    Apply copyright watermark to all images in a directory.

    Args:
        input_dir: Directory containing input images
        output_dir: Directory to save watermarked images
        config: Copyright configuration
        year: Year to use in copyright text

    Returns:
        List of output file paths
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    # Find all image files
    image_extensions = {".jpg", ".jpeg", ".png", ".tiff", ".tif"}
    input_files = [
        f for f in input_dir.iterdir()
        if f.suffix.lower() in image_extensions
    ]

    output_files = []

    for input_file in input_files:
        # Read image
        image = cv2.imread(str(input_file))
        if image is None:
            console.print(f"  [yellow]Warning: Could not read {input_file.name}[/]")
            continue

        # Apply watermark
        watermarked = add_copyright_watermark(image, config, year)

        # Save output
        output_file = output_dir / input_file.name
        cv2.imwrite(str(output_file), watermarked)
        output_files.append(output_file)

    return output_files


def process_single_image(
    input_path: Path,
    output_path: Path,
    config: CopyrightConfig,
    year: Optional[int] = None,
) -> bool:
    """
    Apply copyright watermark to a single image.

    Args:
        input_path: Path to input image
        output_path: Path to save watermarked image
        config: Copyright configuration
        year: Year to use in copyright text

    Returns:
        True if successful, False otherwise
    """
    # Read image
    image = cv2.imread(str(input_path))
    if image is None:
        console.print(f"  [red]Error: Could not read {input_path}[/]")
        return False

    # Apply watermark
    watermarked = add_copyright_watermark(image, config, year)

    # Ensure output directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Save output
    cv2.imwrite(str(output_path), watermarked)
    return True

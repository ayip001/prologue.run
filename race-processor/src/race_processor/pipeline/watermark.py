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


import math
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from rich.console import Console

from ..config import CopyrightConfig

console = Console()

# --- Watermark Constants ---
DEFAULT_FONT_SIZE_RATIO = 0.014  # 1.4% of image height
DEFAULT_X_PCT = 55.0           # Horizontal center-right
DEFAULT_Y_PCT = 70.0           # Lower-middle vertical
DEFAULT_OPACITY = 180          # 0-255
DEFAULT_SHADOW_OFFSET = 2
# ---------------------------


def get_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    """
    Get a font for rendering text. Tries to find a good sans-serif font,
    falls back to default if none available.
    """
    # Common sans-serif fonts to try (in order of preference)
    font_paths = [
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/segoeui.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
        "/usr/share/fonts/TTF/DejaVuSans.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/SFNSText.ttf",
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
    Respects equirectangular projection by applying horizontal stretching
    based on latitude.

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

    # Calculate position
    if config.position == "custom":
        x_pct, y_pct = config.custom_x_pct, config.custom_y_pct
    else:
        # Map named positions to percentages
        margin_x_pct = config.margin_ratio * 100
        margin_y_pct = config.margin_ratio * 100
        
        if config.position == "bottom-left":
            x_pct, y_pct = margin_x_pct, 100 - margin_y_pct
        elif config.position == "bottom-center":
            x_pct, y_pct = 50.0, 100 - margin_y_pct
        else:  # bottom-right
            x_pct, y_pct = 100 - margin_x_pct, 100 - margin_y_pct

    # Latitude calculation (phi)
    # y = 0 (top) -> phi = pi/2 (90 deg)
    # y = 0.5 (middle) -> phi = 0 (0 deg)
    # y = 1 (bottom) -> phi = -pi/2 (-90 deg)
    y_norm = y_pct / 100.0
    phi = (0.5 - y_norm) * math.pi
    
    # Horizontal stretch factor for equirectangular projection
    # stretch = 1 / cos(phi)
    # We clip cos(phi) to avoid infinite stretch at poles
    cos_phi = math.cos(phi)
    stretch_factor = 1.0 / max(0.01, cos_phi)

    # 1. Render text to a high-res scratch surface first
    # We use a larger font size for better quality during stretching
    render_scale = 2
    temp_font = get_font(font_size * render_scale)
    
    # Use a dummy draw to get text size
    dummy_img = Image.new("RGBA", (1, 1))
    dummy_draw = ImageDraw.Draw(dummy_img)
    bbox = dummy_draw.textbbox((0, 0), text, font=temp_font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    pad = 20 * render_scale
    
    # Create text surface
    text_surf = Image.new("RGBA", (tw + pad, th + pad), (0, 0, 0, 0))
    text_draw = ImageDraw.Draw(text_surf)
    
    # Draw shadow
    so = config.shadow_offset * render_scale
    text_draw.text((pad//2 + so, pad//2 + so), text, font=temp_font, fill=config.shadow_color)
    # Draw main text
    text_draw.text((pad//2, pad//2), text, font=temp_font, fill=config.font_color)
    
    # 2. Apply horizontal stretch
    new_tw = int(text_surf.width * stretch_factor / render_scale)
    new_th = int(text_surf.height / render_scale)
    
    # If the stretch is too large (near poles), we might need to wrap it
    # but for a watermark we'll just resize it
    stretched_text = text_surf.resize((new_tw, new_th), Image.Resampling.LANCZOS)
    
    # 3. Composite onto main image
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    pil_image = Image.fromarray(image_rgb).convert("RGBA")
    
    # Calculate final pixel coordinates
    # (x_pct, y_pct) is the center of the text
    pos_x = int((x_pct / 100.0) * width) - (new_tw // 2)
    pos_y = int((y_pct / 100.0) * height) - (new_th // 2)
    
    # Create overlay same size as image
    overlay = Image.new("RGBA", pil_image.size, (0, 0, 0, 0))
    
    # Handle horizontal wrapping if text goes off edge
    if pos_x < 0:
        overlay.paste(stretched_text, (pos_x + width, pos_y))
        overlay.paste(stretched_text, (pos_x, pos_y))
    elif pos_x + new_tw > width:
        overlay.paste(stretched_text, (pos_x - width, pos_y))
        overlay.paste(stretched_text, (pos_x, pos_y))
    else:
        overlay.paste(stretched_text, (pos_x, pos_y))
        
    # Composite
    result_pil = Image.alpha_composite(pil_image, overlay)
    
    # Convert back to BGR
    result_bgr = cv2.cvtColor(np.array(result_pil.convert("RGB")), cv2.COLOR_RGB2BGR)
    
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

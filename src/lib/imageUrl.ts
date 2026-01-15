import { CDN_BASE_URL } from "./constants";
import type { ImageTier, ImageUrls } from "@/types";

// Cache for AVIF support detection
let _supportsAvif: boolean | null = null;

/**
 * Detect if the browser supports AVIF images.
 * Result is cached for subsequent calls.
 */
export async function supportsAvif(): Promise<boolean> {
  if (_supportsAvif !== null) return _supportsAvif;

  // Minimal AVIF image encoded in base64
  const avifData =
    "data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKBzgAPtAgIAAAACCQVQAMCAAmAAQGBAQEBAQE";

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      _supportsAvif = true;
      resolve(true);
    };
    img.onerror = () => {
      _supportsAvif = false;
      resolve(false);
    };
    img.src = avifData;
  });
}

/**
 * Get the image URL for a specific race, tier, and position.
 */
export function getImageUrl(
  raceSlug: string,
  tier: ImageTier,
  positionIndex: number,
  format: "avif" | "webp" = "avif"
): string {
  // Position index is 0-based, but filenames are 1-based with padding
  const paddedIndex = String(positionIndex + 1).padStart(4, "0");
  const tierPath = tier === "thumbnail" ? "thumb" : tier;
  // Images in R2 are stored under races/{slug}/...
  return `${CDN_BASE_URL}/races/${raceSlug}/${tierPath}/${paddedIndex}.${format}`;
}

/**
 * Get all image URLs for a specific position (all tiers and formats).
 */
export function getAllImageUrls(raceSlug: string, positionIndex: number): ImageUrls {
  return {
    thumbnail: getImageUrl(raceSlug, "thumbnail", positionIndex, "avif"),
    thumbnailWebp: getImageUrl(raceSlug, "thumbnail", positionIndex, "webp"),
    medium: getImageUrl(raceSlug, "medium", positionIndex, "avif"),
    mediumWebp: getImageUrl(raceSlug, "medium", positionIndex, "webp"),
    full: getImageUrl(raceSlug, "full", positionIndex, "avif"),
    fullWebp: getImageUrl(raceSlug, "full", positionIndex, "webp"),
  };
}

/**
 * Get the best available image URL based on browser support.
 */
export async function getBestImageUrl(
  raceSlug: string,
  tier: ImageTier,
  positionIndex: number
): Promise<string> {
  const format = (await supportsAvif()) ? "avif" : "webp";
  return getImageUrl(raceSlug, tier, positionIndex, format);
}

/**
 * Preload an image and return a promise that resolves when loaded.
 */
export function preloadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Get the route SVG URL for a race card.
 */
export function getRouteSvgUrl(raceSlug: string, svgPath: string | null): string | null {
  if (!svgPath) return null;
  return `${CDN_BASE_URL}/races/${raceSlug}/assets/${svgPath}`;
}

/**
 * Get the card image URL for a race.
 */
export function getCardImageUrl(raceSlug: string, imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  // If it's a full URL, return as-is
  if (imageUrl.startsWith("http")) return imageUrl;
  // Otherwise, treat as relative path
  return `${CDN_BASE_URL}/races/${raceSlug}/assets/${imageUrl}`;
}

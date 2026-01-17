import { CDN_BASE_URL } from "./constants";
import type { ImageTier, ImageUrls } from "@/types";

/**
 * Get the image URL for a specific race, tier, and position.
 */
export function getImageUrl(
  raceSlug: string,
  tier: ImageTier,
  positionIndex: number,
  format: "webp" = "webp"
): string {
  // Position index is 0-based, but filenames are 1-based with padding
  const paddedIndex = String(positionIndex + 1).padStart(4, "0");
  const tierPath = tier === "thumbnail" ? "thumb" : tier;
  // Images in R2 are stored under races/{slug}/...
  return `${CDN_BASE_URL}/races/${raceSlug}/${tierPath}/${paddedIndex}.${format}`;
}

/**
 * Get all image URLs for a specific position (all tiers).
 */
export function getAllImageUrls(raceSlug: string, positionIndex: number): ImageUrls {
  return {
    thumbnail: getImageUrl(raceSlug, "thumbnail", positionIndex, "webp"),
    medium: getImageUrl(raceSlug, "medium", positionIndex, "webp"),
    full: getImageUrl(raceSlug, "full", positionIndex, "webp"),
  };
}

/**
 * Get the best available image URL (always WebP).
 */
export function getBestImageUrl(
  raceSlug: string,
  tier: ImageTier,
  positionIndex: number
): string {
  return getImageUrl(raceSlug, tier, positionIndex, "webp");
}

/**
 * Preload an image and return a promise that resolves when loaded.
 */
export function preloadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Required for cross-origin images, especially on iOS Safari
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Get the minimap image URL for a race card.
 */
export function getMinimapUrl(raceSlug: string, minimapPath: string | null): string | null {
  if (!minimapPath) return null;
  // If it's a full URL, return as-is
  if (minimapPath.startsWith("http")) return minimapPath;
  // Otherwise, treat as relative path
  return `${CDN_BASE_URL}/races/${raceSlug}/assets/${minimapPath}`;
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

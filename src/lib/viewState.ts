import type { ViewState } from "@/types";
import { DEFAULT_VIEW } from "./constants";

/**
 * Parse view state from URL pathname.
 *
 * URL format: /@{position},{heading}h,{pitch}p,{fov}f
 * Examples:
 *   /@0 → position 0, default heading/pitch/fov
 *   /@842,125.5h,-12.3p,60f → full view state
 */
export function parseViewState(pathname: string): ViewState | null {
  // Match: /@{position},{heading}h,{pitch}p,{fov}f
  const match = pathname.match(
    /@(\d+)(?:,(-?\d+\.?\d*)h)?(?:,(-?\d+\.?\d*)p)?(?:,(\d+\.?\d*)f)?/
  );

  if (!match) return null;

  return {
    position: parseInt(match[1], 10),
    heading: match[2] ? parseFloat(match[2]) : DEFAULT_VIEW.heading,
    pitch: match[3] ? parseFloat(match[3]) : DEFAULT_VIEW.pitch,
    fov: match[4] ? parseFloat(match[4]) : DEFAULT_VIEW.fov,
  };
}

/**
 * Serialize view state to URL fragment.
 * Omits default values for cleaner URLs.
 */
export function serializeViewState(state: ViewState): string {
  const { position, heading, pitch, fov } = state;

  // Start with position (always required)
  const parts = [`@${position}`];

  // Only add camera params if any are non-default
  const hasNonDefaultCamera =
    heading !== DEFAULT_VIEW.heading ||
    pitch !== DEFAULT_VIEW.pitch ||
    fov !== DEFAULT_VIEW.fov;

  if (hasNonDefaultCamera) {
    parts.push(`${heading.toFixed(1)}h`);
    parts.push(`${pitch.toFixed(1)}p`);

    // Only add fov if non-default
    if (fov !== DEFAULT_VIEW.fov) {
      parts.push(`${fov.toFixed(0)}f`);
    }
  }

  return parts.join(",");
}

/**
 * Create a shareable URL for the current view state.
 */
export function createShareUrl(raceSlug: string, state: ViewState): string {
  const base =
    typeof window !== "undefined"
      ? `${window.location.origin}/race/${raceSlug}`
      : `/race/${raceSlug}`;

  return `${base}/${serializeViewState(state)}`;
}

/**
 * Normalize heading to 0-360 range.
 */
export function normalizeHeading(heading: number): number {
  return ((heading % 360) + 360) % 360;
}

/**
 * Clamp pitch to valid range (-90 to 90).
 */
export function clampPitch(pitch: number): number {
  return Math.max(-90, Math.min(90, pitch));
}

/**
 * Clamp FOV to valid range (30 to 120).
 */
export function clampFov(fov: number): number {
  return Math.max(30, Math.min(120, fov));
}

/**
 * Calculate the camera rotation needed to align with a specific heading.
 */
export function calculateHeadingOffset(
  currentHeading: number,
  targetHeading: number
): number {
  const diff = targetHeading - currentHeading;
  // Normalize to -180 to 180 range for shortest rotation
  if (diff > 180) return diff - 360;
  if (diff < -180) return diff + 360;
  return diff;
}

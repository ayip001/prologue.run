/**
 * Format distance in meters to a human-readable string.
 * Examples: "5.2 km", "42.195 km", "850 m"
 */
export function formatDistance(meters: number, options?: { precision?: number }): string {
  const precision = options?.precision ?? 1;

  if (meters >= 1000) {
    const km = meters / 1000;
    return `${km.toFixed(precision)} km`;
  }
  return `${Math.round(meters)} m`;
}

/**
 * Format distance specifically for the HUD display (more compact).
 * Examples: "5.2", "42.1"
 */
export function formatDistanceCompact(meters: number): string {
  const km = meters / 1000;
  return km.toFixed(1);
}

/**
 * Format elevation in meters.
 * Examples: "125 m", "-50 m", "+320 m"
 */
export function formatElevation(meters: number, options?: { showSign?: boolean }): string {
  const rounded = Math.round(meters);
  if (options?.showSign && rounded > 0) {
    return `+${rounded} m`;
  }
  return `${rounded} m`;
}

/**
 * Format elevation for HUD display (compact, no unit).
 */
export function formatElevationCompact(meters: number): string {
  return Math.round(meters).toString();
}

/**
 * Format elevation gain/loss summary.
 * Example: "+320m / -180m"
 */
export function formatElevationSummary(gain: number | null, loss: number | null): string {
  const gainStr = gain !== null ? `+${Math.round(gain)}m` : "+0m";
  const lossStr = loss !== null ? `-${Math.round(Math.abs(loss))}m` : "-0m";
  return `${gainStr} / ${lossStr}`;
}

/**
 * Format a date to a display string.
 */
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format camera heading as compass direction.
 */
export function formatHeading(degrees: number): string {
  const normalized = ((degrees % 360) + 360) % 360;
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(normalized / 45) % 8;
  return directions[index];
}

/**
 * Format position as "Image X of Y".
 */
export function formatPosition(current: number, total: number): string {
  return `${current + 1} of ${total}`;
}

/**
 * Format percentage (0-100).
 */
export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

/**
 * Format a race distance in kilometers with appropriate suffix.
 * Examples: "Marathon", "Half Marathon", "10K", "5K", "42.2km"
 */
export function formatRaceDistance(meters: number): string {
  const km = meters / 1000;

  // Check for standard race distances
  if (Math.abs(km - 42.195) < 0.1) return "Marathon";
  if (Math.abs(km - 21.0975) < 0.1) return "Half Marathon";
  if (Math.abs(km - 10) < 0.1) return "10K";
  if (Math.abs(km - 5) < 0.1) return "5K";

  // For other distances, show km
  if (km >= 10) {
    return `${Math.round(km)}km`;
  }
  return `${km.toFixed(1)}km`;
}

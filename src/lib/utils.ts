import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS classes with proper precedence.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Find the closest value in a sorted array using binary search.
 * Returns the index of the closest element.
 */
export function findClosestIndex(arr: number[], target: number): number {
  if (arr.length === 0) return -1;
  if (arr.length === 1) return 0;

  let left = 0;
  let right = arr.length - 1;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  // Check which neighbor is closest
  if (left === 0) return 0;
  if (left >= arr.length) return arr.length - 1;

  const prevDiff = Math.abs(arr[left - 1] - target);
  const currDiff = Math.abs(arr[left] - target);

  return prevDiff < currDiff ? left - 1 : left;
}

/**
 * Linear interpolation between two values.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Clamp a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Debounce a function call.
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

/**
 * Throttle a function call.
 */
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Generate a range of numbers.
 */
export function range(start: number, end: number): number[] {
  return Array.from({ length: end - start }, (_, i) => start + i);
}

/**
 * Check if we're running on the client side.
 */
export function isClient(): boolean {
  return typeof window !== "undefined";
}

/**
 * Check if we're running on a touch device.
 */
export function isTouchDevice(): boolean {
  if (!isClient()) return false;
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

/**
 * Calculate distance between two GPS coordinates using Haversine formula.
 * Returns distance in meters.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Interpolate elevation at a given distance from a list of elevation points.
 */
export function interpolateElevation(
  points: Array<{ distance: number; elevation: number }>,
  targetDistance: number
): number {
  if (points.length === 0) return 0;
  if (points.length === 1) return points[0].elevation;

  // Find surrounding points
  let lower = points[0];
  let upper = points[points.length - 1];

  for (let i = 0; i < points.length - 1; i++) {
    if (points[i].distance <= targetDistance && points[i + 1].distance >= targetDistance) {
      lower = points[i];
      upper = points[i + 1];
      break;
    }
  }

  // Handle edge cases
  if (targetDistance <= lower.distance) return lower.elevation;
  if (targetDistance >= upper.distance) return upper.elevation;

  // Linear interpolation
  const t = (targetDistance - lower.distance) / (upper.distance - lower.distance);
  return lerp(lower.elevation, upper.elevation, t);
}

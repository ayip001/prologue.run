/**
 * Computes visual distances for scrubber positioning.
 *
 * When GPS signal is lost (e.g., in tunnels), multiple consecutive images
 * may have identical `distanceFromStart` values. This creates "invisible gaps"
 * in the scrubber where users can't click to reach those images.
 *
 * This utility spreads consecutive same-distance images evenly across the
 * visual gap to the next distinct distance, making all images reachable
 * via the scrubber while preserving the original distance data for display.
 */

interface ImageWithDistance {
  distanceFromStart: number | null;
}

/**
 * Computes visual distances for an array of images.
 * Images with identical consecutive distances are spread linearly
 * toward the next distinct distance value.
 *
 * @param images - Array of images with distanceFromStart values
 * @returns Array of visual distances (same length as input)
 */
export function computeVisualDistances(
  images: ImageWithDistance[]
): number[] {
  if (images.length === 0) return [];

  // Initialize with real distances (null becomes 0)
  const visualDistances = images.map((img) => img.distanceFromStart ?? 0);

  let i = 0;
  while (i < images.length) {
    const currentDist = visualDistances[i];

    // Find the end of this run of identical distances
    let runEnd = i;
    while (
      runEnd + 1 < images.length &&
      visualDistances[runEnd + 1] === currentDist
    ) {
      runEnd++;
    }

    const runLength = runEnd - i + 1;

    // Only spread if we have multiple images with the same distance
    if (runLength > 1) {
      // Find the next distinct distance value
      const nextDist =
        runEnd + 1 < images.length ? visualDistances[runEnd + 1] : null;

      // Only spread if next distance exists and is greater (normal forward progress)
      if (nextDist !== null && nextDist > currentDist) {
        const gap = nextDist - currentDist;

        // Spread images linearly: first stays at currentDist,
        // last approaches (but doesn't reach) nextDist
        for (let j = i; j <= runEnd; j++) {
          const t = (j - i) / runLength;
          visualDistances[j] = currentDist + t * gap;
        }
      }
      // If no valid next distance, keep original values (can't spread)
    }

    i = runEnd + 1;
  }

  return visualDistances;
}

/**
 * Finds the image index closest to a target visual distance.
 * Used when user clicks on the scrubber to find which image to show.
 *
 * @param targetDistance - The visual distance clicked/dragged to
 * @param visualDistances - Array of computed visual distances
 * @returns Index of the closest image
 */
export function findIndexByVisualDistance(
  targetDistance: number,
  visualDistances: number[]
): number {
  if (visualDistances.length === 0) return 0;

  let closestIndex = 0;
  let closestDiff = Math.abs(visualDistances[0] - targetDistance);

  for (let i = 1; i < visualDistances.length; i++) {
    const diff = Math.abs(visualDistances[i] - targetDistance);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestIndex = i;
    }
  }

  return closestIndex;
}

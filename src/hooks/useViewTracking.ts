"use client";

import { useEffect, useRef } from "react";
import { ENABLE_VIEW_COUNTING } from "@/lib/constants";

const VIEW_DELAY_MS = 5000; // 5 seconds before counting a view

/**
 * Hook to track views for a race.
 * Only fires after the user has been on the page for 5+ seconds.
 * Rate limited on the server to 1 view per IP per race per hour.
 */
export function useViewTracking(raceSlug: string) {
  const hasFired = useRef(false);

  useEffect(() => {
    // Don't track if disabled or already fired
    if (!ENABLE_VIEW_COUNTING || hasFired.current) {
      return;
    }

    const timeoutId = setTimeout(async () => {
      if (hasFired.current) return;
      hasFired.current = true;

      try {
        const response = await fetch(`/api/races/${raceSlug}/view`, {
          method: "POST",
        });

        if (!response.ok && response.status !== 429) {
          // Log non-rate-limit errors for debugging
          console.warn("View tracking failed:", response.status);
        }
      } catch {
        // Silently fail - view tracking is not critical
      }
    }, VIEW_DELAY_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [raceSlug]);
}

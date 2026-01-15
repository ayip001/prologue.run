"use client";

import { useEffect, useRef } from "react";
import type { ViewerState } from "@/types";
import { serializeViewState } from "@/lib/viewState";
import { URL_UPDATE_DEBOUNCE_MS } from "@/lib/constants";

interface UseViewStateUrlOptions {
  raceSlug: string;
  state: ViewerState;
  enabled?: boolean;
}

export function useViewStateUrl({
  raceSlug,
  state,
  enabled = true,
}: UseViewStateUrlOptions): void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastPositionRef = useRef(state.currentIndex);
  // Track if this is the initial mount - skip first URL update to preserve URL params
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    // Skip URL update on initial mount to preserve URL parameters
    if (isInitialMountRef.current) {
      console.log("[useViewStateUrl] Skipping initial mount URL update");
      isInitialMountRef.current = false;
      return;
    }

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce URL updates
    timeoutRef.current = setTimeout(() => {
      const viewState = {
        position: state.currentIndex,
        heading: state.camera.yaw,
        pitch: state.camera.pitch,
        fov: state.camera.fov,
      };

      const serialized = serializeViewState(viewState);
      const newUrl = `/race/${raceSlug}/${serialized}`;

      console.log("[useViewStateUrl] Updating URL to:", newUrl);

      // Use pushState for position changes, replaceState for camera changes
      const method =
        state.currentIndex !== lastPositionRef.current
          ? "pushState"
          : "replaceState";

      window.history[method](null, "", newUrl);
      lastPositionRef.current = state.currentIndex;
    }, URL_UPDATE_DEBOUNCE_MS);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [
    raceSlug,
    state.currentIndex,
    state.camera.yaw,
    state.camera.pitch,
    state.camera.fov,
    enabled,
  ]);
}

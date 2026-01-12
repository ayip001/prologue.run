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

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

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

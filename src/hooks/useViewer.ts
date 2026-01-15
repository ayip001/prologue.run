"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import type { CameraState, ViewerState, ViewerActions } from "@/types";
import { DEFAULT_VIEW, CAMERA_CONSTRAINTS } from "@/lib/constants";
import { normalizeHeading, clampPitch, clampFov, parseViewState } from "@/lib/viewState";

interface UseViewerOptions {
  totalImages: number;
  images: Array<{ positionIndex: number; distanceFromStart: number | null }>;
  initialPosition?: number;
  initialCamera?: Partial<CameraState>;
}

interface UseViewerReturn {
  state: ViewerState;
  actions: ViewerActions;
}

export function useViewer({
  totalImages,
  images,
  initialPosition = 0,
  initialCamera,
}: UseViewerOptions): UseViewerReturn {
  const [state, setState] = useState<ViewerState>(() => ({
    currentIndex: Math.min(initialPosition, totalImages - 1),
    currentDistance: images[initialPosition]?.distanceFromStart ?? 0,
    camera: {
      yaw: initialCamera?.yaw ?? DEFAULT_VIEW.heading,
      pitch: initialCamera?.pitch ?? DEFAULT_VIEW.pitch,
      fov: initialCamera?.fov ?? DEFAULT_VIEW.fov,
    },
    loadedTier: "thumbnail",
    isLoading: true,
    isHUDVisible: true,
    isDraggingScrubber: false,
  }));

  // Track if this is the first render
  const isFirstRender = useRef(true);
  // Track if we've synced with URL
  const hasSyncedWithUrl = useRef(false);

  // On mount, parse URL and sync state if server props were lost during hydration
  useEffect(() => {
    if (hasSyncedWithUrl.current) return;
    hasSyncedWithUrl.current = true;

    if (typeof window === "undefined") return;

    const pathname = window.location.pathname;
    console.log("[useViewer] Syncing with URL:", pathname);

    const parsed = parseViewState(pathname);
    console.log("[useViewer] Parsed view state from URL:", parsed);

    if (!parsed) return;

    // Check if current state differs from URL
    const needsUpdate =
      state.currentIndex !== parsed.position ||
      Math.abs(state.camera.yaw - parsed.heading) > 0.1 ||
      Math.abs(state.camera.pitch - parsed.pitch) > 0.1;

    if (needsUpdate) {
      console.log("[useViewer] State differs from URL, updating...");
      console.log("[useViewer] Current state:", {
        currentIndex: state.currentIndex,
        yaw: state.camera.yaw,
        pitch: state.camera.pitch,
      });
      console.log("[useViewer] URL values:", {
        position: parsed.position,
        heading: parsed.heading,
        pitch: parsed.pitch,
      });

      const clampedIndex = Math.min(parsed.position, totalImages - 1);
      setState((prev) => ({
        ...prev,
        currentIndex: clampedIndex,
        currentDistance: images[clampedIndex]?.distanceFromStart ?? 0,
        camera: {
          yaw: parsed.heading,
          pitch: parsed.pitch,
          fov: parsed.fov,
        },
      }));
    }
  }, []);  // Empty deps - run only on mount

  // Update distance when index changes
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const image = images[state.currentIndex];
    if (image && image.distanceFromStart !== null) {
      setState((prev) => ({
        ...prev,
        currentDistance: image.distanceFromStart ?? 0,
      }));
    }
  }, [state.currentIndex, images]);

  // Actions
  const goToIndex = useCallback(
    (index: number) => {
      const clampedIndex = Math.max(0, Math.min(totalImages - 1, index));
      setState((prev) => ({
        ...prev,
        currentIndex: clampedIndex,
        isLoading: true,
        loadedTier: "thumbnail",
      }));
    },
    [totalImages]
  );

  const goToDistance = useCallback(
    (distanceM: number) => {
      // Find the image closest to the target distance
      let closestIndex = 0;
      let closestDiff = Infinity;

      for (let i = 0; i < images.length; i++) {
        const imgDist = images[i].distanceFromStart ?? 0;
        const diff = Math.abs(imgDist - distanceM);
        if (diff < closestDiff) {
          closestDiff = diff;
          closestIndex = i;
        }
      }

      goToIndex(closestIndex);
    },
    [images, goToIndex]
  );

  const goNext = useCallback(() => {
    goToIndex(state.currentIndex + 1);
  }, [state.currentIndex, goToIndex]);

  const goPrevious = useCallback(() => {
    goToIndex(state.currentIndex - 1);
  }, [state.currentIndex, goToIndex]);

  const setCamera = useCallback((camera: Partial<CameraState>) => {
    setState((prev) => ({
      ...prev,
      camera: {
        yaw: camera.yaw !== undefined ? normalizeHeading(camera.yaw) : prev.camera.yaw,
        pitch:
          camera.pitch !== undefined
            ? clampPitch(camera.pitch)
            : prev.camera.pitch,
        fov:
          camera.fov !== undefined
            ? clampFov(camera.fov)
            : prev.camera.fov,
      },
    }));
  }, []);

  const seekByDrag = useCallback(
    (distance: number) => {
      setState((prev) => ({
        ...prev,
        isDraggingScrubber: true,
      }));
      goToDistance(distance);
    },
    [goToDistance]
  );

  const actions: ViewerActions = {
    goToIndex,
    goToDistance,
    goNext,
    goPrevious,
    setCamera,
    seekByDrag,
  };

  return { state, actions };
}

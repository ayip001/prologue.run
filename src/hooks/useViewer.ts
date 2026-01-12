"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import type { CameraState, ViewerState, ViewerActions } from "@/types";
import { DEFAULT_VIEW, CAMERA_CONSTRAINTS } from "@/lib/constants";
import { normalizeHeading, clampPitch, clampFov } from "@/lib/viewState";

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

"use client";

import { useCallback, useMemo, useRef, useEffect, useState } from "react";
import type { Race, ElevationProfile as ElevationProfileType } from "@/types";
import { useViewer } from "@/hooks/useViewer";
import { useImageLoader } from "@/hooks/useImageLoader";
import { useKeyboardNav } from "@/hooks/useKeyboardNav";
import { useViewStateUrl } from "@/hooks/useViewStateUrl";
import { parseViewState } from "@/lib/viewState";
import { DEFAULT_VIEW } from "@/lib/constants";
import { PanoramaCanvas } from "./PanoramaCanvas";
import { ViewerHUD } from "./ViewerHUD";
import { NavigationChevrons } from "./NavigationChevrons";
import { ProgressScrubber } from "./ProgressScrubber";
import { ElevationProfile } from "./ElevationProfile";
import { interpolateElevation } from "@/lib/utils";

interface ImageMeta {
  id: string;
  positionIndex: number;
  latitude: number | null;
  longitude: number | null;
  distanceFromStart: number | null;
  capturedAt: string;
  headingDegrees: number | null;
  headingToPrev: number | null;
  headingToNext: number | null;
}

interface Waypoint {
  name: string;
  distanceMeters: number;
  endDistanceMeters: number | null;
}

interface RaceViewerProps {
  race: Race;
  images: ImageMeta[];
  waypoints: Waypoint[];
  elevationProfile: ElevationProfileType | null;
  initialPosition?: number;
  initialHeading?: number;
  initialPitch?: number;
  initialFov?: number;
  testImageUrl?: string;
}

export function RaceViewer({
  race,
  images,
  waypoints,
  elevationProfile,
  initialPosition = 0,
  initialHeading = DEFAULT_VIEW.heading,
  initialPitch = DEFAULT_VIEW.pitch,
  initialFov = DEFAULT_VIEW.fov,
  testImageUrl,
}: RaceViewerProps) {
  // Parse URL directly on client to get correct initial values
  // This handles cases where server props are lost during hydration
  const [initialCameraFromUrl, setInitialCameraFromUrl] = useState(() => {
    if (typeof window === "undefined") {
      return { yaw: initialHeading, pitch: initialPitch };
    }
    const parsed = parseViewState(window.location.pathname);
    return {
      yaw: parsed?.heading ?? initialHeading,
      pitch: parsed?.pitch ?? initialPitch,
    };
  });

  // Re-parse URL on mount in case initial parse missed something
  useEffect(() => {
    const parsed = parseViewState(window.location.pathname);
    if (parsed) {
      setInitialCameraFromUrl({
        yaw: parsed.heading,
        pitch: parsed.pitch,
      });
    }
  }, []);

  // Memoize mapped images to prevent infinite loop
  const mappedImages = useMemo(
    () =>
      images.map((img) => ({
        positionIndex: img.positionIndex,
        distanceFromStart: img.distanceFromStart ?? 0,
      })),
    [images]
  );

  // Viewer state
  const { state, actions } = useViewer({
    totalImages: images.length,
    images: mappedImages,
    initialPosition,
    initialCamera: {
      yaw: initialHeading,
      pitch: initialPitch,
      fov: initialFov,
    },
  });

  // Image loading (disabled for test routes)
  const { currentImageUrl: loadedImageUrl, isLoading: isImageLoading } = useImageLoader({
    raceSlug: race.slug,
    currentIndex: state.currentIndex,
    totalImages: images.length,
    enabled: !testImageUrl,
  });

  // Use test image URL if provided, otherwise use loaded image
  const currentImageUrl = testImageUrl || loadedImageUrl;
  const isLoading = testImageUrl ? false : isImageLoading;

  // Keyboard navigation
  useKeyboardNav({ actions });

  // URL state sync
  useViewStateUrl({ raceSlug: race.slug, state });

  // Calculate current elevation
  const currentElevation = useMemo(() => {
    if (!elevationProfile) return 0;
    return interpolateElevation(elevationProfile.points, state.currentDistance);
  }, [elevationProfile, state.currentDistance]);

  // Find active waypoint
  const activeWaypoint = useMemo(() => {
    const distance = state.currentDistance;
    for (const wp of waypoints) {
      const endDist = wp.endDistanceMeters ?? wp.distanceMeters + 500; // Default 500m range
      if (distance >= wp.distanceMeters && distance <= endDist) {
        return wp.name;
      }
    }
    return null;
  }, [waypoints, state.currentDistance]);

  // Get current image heading data for ground arrows
  const currentImageHeading = useMemo(() => {
    const currentImage = images[state.currentIndex];
    if (!currentImage) return null;
    return {
      headingDegrees: currentImage.headingDegrees,
      headingToPrev: currentImage.headingToPrev,
      headingToNext: currentImage.headingToNext,
    };
  }, [images, state.currentIndex]);

  // Handlers
  const handleCameraChange = useCallback(
    (camera: Parameters<typeof actions.setCamera>[0]) => {
      actions.setCamera(camera);
    },
    [actions]
  );

  const handleSeek = useCallback(
    (distance: number) => {
      actions.goToDistance(distance);
    },
    [actions]
  );

  return (
    <div className="fixed inset-0 bg-slate-950">
      {/* Panorama Canvas */}
      <PanoramaCanvas
        imageUrl={currentImageUrl}
        camera={state.camera}
        initialCamera={initialCameraFromUrl}
        onCameraChange={handleCameraChange}
        isLoading={isLoading}
        headingData={currentImageHeading}
        onNavigateNext={state.currentIndex < images.length - 1 ? actions.goNext : undefined}
        onNavigatePrev={state.currentIndex > 0 ? actions.goPrevious : undefined}
      />

      {/* HUD Overlay */}
      <ViewerHUD
        raceName={race.name}
        distanceMeters={state.currentDistance}
        totalDistanceMeters={race.distanceMeters}
        elevationM={currentElevation}
        waypointName={activeWaypoint}
        isVisible={state.isHUDVisible}
      />

      {/* Navigation Chevrons */}
      <NavigationChevrons
        onPrevious={actions.goPrevious}
        onNext={actions.goNext}
        hasPrevious={state.currentIndex > 0}
        hasNext={state.currentIndex < images.length - 1}
      />

      {/* Bottom Controls */}
      <div className="absolute inset-x-0 bottom-0 z-30">
        {/* Elevation Profile */}
        {elevationProfile && (
          <ElevationProfile
            profile={elevationProfile}
            currentDistance={state.currentDistance}
          />
        )}

        {/* Progress Scrubber */}
        <ProgressScrubber
          totalDistance={race.distanceMeters}
          currentDistance={state.currentDistance}
          onSeek={handleSeek}
        />
      </div>
    </div>
  );
}

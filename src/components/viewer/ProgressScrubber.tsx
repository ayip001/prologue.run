"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { formatDistanceCompact } from "@/lib/formatters";
import { SCRUBBER_POI_SNAP_STRENGTH } from "@/lib/constants";
import type { PoiMarker } from "@/types";
import { ScrubberPoiMarkers } from "./ScrubberPoiMarkers";

interface ProgressScrubberProps {
  totalDistance: number;
  currentDistance: number;
  // Visual distances for scrubber positioning (handles GPS gaps in tunnels)
  // If not provided, falls back to real distances
  totalVisualDistance?: number;
  currentVisualDistance?: number;
  elevationBars?: number[] | null;
  poiMarkers?: PoiMarker[] | null;
  onPoiClick?: (imageIndex: number) => void;
  onSeek: (distance: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  className?: string;
}

export function ProgressScrubber({
  totalDistance,
  currentDistance,
  totalVisualDistance,
  currentVisualDistance,
  elevationBars,
  poiMarkers,
  onPoiClick,
  onSeek,
  onDragStart,
  onDragEnd,
  className,
}: ProgressScrubberProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const activePointerId = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverDistance, setHoverDistance] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);
  const [activePoiImageIndex, setActivePoiImageIndex] = useState<number | null>(null);

  // Use visual distances for positioning if provided, otherwise fall back to real distances
  const effectiveTotalDistance = totalVisualDistance ?? totalDistance;
  const effectiveCurrentDistance = currentVisualDistance ?? currentDistance;

  const progress = effectiveTotalDistance > 0 ? (effectiveCurrentDistance / effectiveTotalDistance) * 100 : 0;

  const getSnapRange = useCallback(() => {
    return effectiveTotalDistance * SCRUBBER_POI_SNAP_STRENGTH;
  }, [effectiveTotalDistance]);

  const getNearestPoiMarker = useCallback(
    (distance: number) => {
      if (!poiMarkers || poiMarkers.length === 0) return null;
      let closest: PoiMarker | null = null;
      let smallestDelta = Number.POSITIVE_INFINITY;

      for (const marker of poiMarkers) {
        const delta = Math.abs(marker.distanceFromStart - distance);
        if (delta < smallestDelta) {
          smallestDelta = delta;
          closest = marker;
        }
      }

      return closest;
    },
    [poiMarkers]
  );

  const getSnappedDistance = useCallback(
    (distance: number) => {
      const nearest = getNearestPoiMarker(distance);
      if (!nearest) {
        return { distance, snappedMarker: null as PoiMarker | null };
      }

      const snapRange = getSnapRange();
      if (snapRange <= 0) {
        return { distance, snappedMarker: null as PoiMarker | null };
      }

      const delta = Math.abs(nearest.distanceFromStart - distance);
      if (delta <= snapRange) {
        return { distance: nearest.distanceFromStart, snappedMarker: nearest };
      }

      return { distance, snappedMarker: null as PoiMarker | null };
    },
    [getNearestPoiMarker, getSnapRange]
  );

  const getDistanceFromEvent = useCallback(
    (e: React.MouseEvent | React.PointerEvent | MouseEvent): number => {
      if (!trackRef.current) return 0;
      const rect = trackRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const percentage = x / rect.width;
      return percentage * effectiveTotalDistance;
    },
    [effectiveTotalDistance]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      // Ignore secondary pointerdowns while a drag is already active
      if (activePointerId.current !== null) return;
      e.preventDefault();
      activePointerId.current = e.pointerId;
      trackRef.current?.setPointerCapture(e.pointerId);
      setIsDragging(true);
      onDragStart?.();

      const distance = getDistanceFromEvent(e);
      const { distance: snappedDistance, snappedMarker } = getSnappedDistance(distance);
      setActivePoiImageIndex(snappedMarker?.imageIndex ?? null);
      onSeek(snappedDistance);
    },
    [getDistanceFromEvent, getSnappedDistance, onSeek, onDragStart]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || activePointerId.current !== e.pointerId) return;
      e.preventDefault();
      const distance = getDistanceFromEvent(e);
      const { distance: snappedDistance, snappedMarker } = getSnappedDistance(distance);
      setActivePoiImageIndex(snappedMarker?.imageIndex ?? null);
      onSeek(snappedDistance);
    },
    [getDistanceFromEvent, getSnappedDistance, isDragging, onSeek]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (activePointerId.current !== e.pointerId) return;
      trackRef.current?.releasePointerCapture(e.pointerId);
      activePointerId.current = null;
      setIsDragging(false);
      onDragEnd?.();
    },
    [onDragEnd]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) return;
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      setHoverX(x);
      setHoverDistance(getDistanceFromEvent(e));
    },
    [getDistanceFromEvent, isDragging]
  );

  const handleMouseLeave = useCallback(() => {
    if (!isDragging) {
      setHoverDistance(null);
    }
  }, [isDragging]);

  useEffect(() => {
    const { snappedMarker } = getSnappedDistance(currentDistance);
    setActivePoiImageIndex(snappedMarker?.imageIndex ?? null);
  }, [currentDistance, getSnappedDistance]);

  return (
    <div className={cn("relative", className)}>
      {/* Tooltip */}
      {hoverDistance !== null && (
        <div
          className="absolute bottom-full mb-2 -translate-x-1/2 pointer-events-none z-10"
          style={{ left: hoverX }}
        >
          <div className="bg-slate-800 text-white text-xs px-2 py-1 rounded shadow-lg border border-white/10">
            {formatDistanceCompact(hoverDistance)} km
          </div>
        </div>
      )}

      {/* Track */}
      <div
        ref={trackRef}
        className="relative h-12 bg-slate-800/80 backdrop-blur-md border-t border-slate-600 cursor-pointer touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <ScrubberPoiMarkers
          poiMarkers={poiMarkers}
          totalDistance={totalDistance}
          onPoiClick={onPoiClick ?? (() => {})}
          activePoiImageIndex={activePoiImageIndex}
        />

        {/* Elevation bars */}
        {elevationBars && elevationBars.length > 0 && (
          <div className="absolute inset-0 flex items-end pointer-events-none">
            {elevationBars.map((value, index) => (
              <div
                key={index}
                className="flex-1 bg-white/30"
                style={{ height: `${Math.max(5, value * 0.9)}%` }}
              />
            ))}
          </div>
        )}

        {/* Progress fill */}
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-coral/30 to-golden/30"
          style={{ width: `${progress}%` }}
        />

        {/* Active line */}
        <div
          className="absolute top-0 left-0 h-0.5 bg-accent-gradient"
          style={{ width: `${progress}%` }}
        />

        {/* Thumb */}
        <div
          className={cn(
            "absolute top-0 bottom-0 w-0.5 bg-white",
            "transform -translate-x-1/2",
            isDragging && "scrubber-thumb"
          )}
          style={{ left: `${progress}%` }}
        >
          {/* Thumb handle */}
          <div
            className={cn(
              "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
              "w-4 h-4 rounded-full bg-white shadow-lg",
              "border-2 border-coral",
              isDragging && "scale-125"
            )}
          />
        </div>

        {/* Distance labels */}
        <div className="absolute bottom-1 left-2 text-xs text-slate-400">
          0 km
        </div>
        <div className="absolute bottom-1 right-2 text-xs text-slate-400">
          {formatDistanceCompact(totalDistance)} km
        </div>
      </div>
    </div>
  );
}

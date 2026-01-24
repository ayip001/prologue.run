"use client";

import { useRef, useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { formatDistanceCompact } from "@/lib/formatters";
import type { PoiMarker } from "@/types";
import { ScrubberPoiMarkers } from "./ScrubberPoiMarkers";
import { MOBILE_SCRUBBER_POI_SNAP_STRENGTH } from "@/lib/constants";

interface ProgressScrubberProps {
  totalDistance: number;
  currentDistance: number;
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
  elevationBars,
  poiMarkers,
  onPoiClick,
  onSeek,
  onDragStart,
  onDragEnd,
  className,
}: ProgressScrubberProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverDistance, setHoverDistance] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);

  const progress = totalDistance > 0 ? (currentDistance / totalDistance) * 100 : 0;
  const snapDistance = useMemo(
    () => totalDistance * MOBILE_SCRUBBER_POI_SNAP_STRENGTH,
    [totalDistance]
  );

  const getDistanceFromEvent = useCallback(
    (e: { clientX: number }): number => {
      if (!trackRef.current) return 0;
      const rect = trackRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const percentage = x / rect.width;
      return percentage * totalDistance;
    },
    [totalDistance]
  );

  const getNearestPoiMarker = useCallback(
    (distance: number) => {
      if (!poiMarkers || poiMarkers.length === 0) return null;
      let nearest = poiMarkers[0];
      let smallestDiff = Math.abs(distance - nearest.distanceFromStart);
      for (const marker of poiMarkers.slice(1)) {
        const diff = Math.abs(distance - marker.distanceFromStart);
        if (diff < smallestDiff) {
          smallestDiff = diff;
          nearest = marker;
        }
      }
      return { marker: nearest, diff: smallestDiff };
    },
    [poiMarkers]
  );

  const getSnappedDistance = useCallback(
    (distance: number, pointerType: React.PointerEvent["pointerType"] | null) => {
      if (!poiMarkers || poiMarkers.length === 0) return distance;
      if (pointerType !== "touch") return distance;
      if (snapDistance <= 0) return distance;
      const nearest = getNearestPoiMarker(distance);
      if (!nearest) return distance;
      if (nearest.diff <= snapDistance) {
        return nearest.marker.distanceFromStart;
      }
      return distance;
    },
    [getNearestPoiMarker, poiMarkers, snapDistance]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      activePointerIdRef.current = e.pointerId;
      setIsDragging(true);
      onDragStart?.();

      const distance = getDistanceFromEvent(e);
      onSeek(getSnappedDistance(distance, e.pointerType));

      const handlePointerMove = (event: PointerEvent) => {
        if (event.pointerId !== activePointerIdRef.current) return;
        const moveDistance = getDistanceFromEvent(event);
        onSeek(getSnappedDistance(moveDistance, event.pointerType));
      };

      const handlePointerUp = (event: PointerEvent) => {
        if (event.pointerId !== activePointerIdRef.current) return;
        setIsDragging(false);
        onDragEnd?.();
        activePointerIdRef.current = null;
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
    },
    [getDistanceFromEvent, getSnappedDistance, onSeek, onDragStart, onDragEnd]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      setHoverX(x);
      setHoverDistance(getDistanceFromEvent(e));
    },
    [getDistanceFromEvent]
  );

  const handleMouseLeave = useCallback(() => {
    if (!isDragging) {
      setHoverDistance(null);
    }
  }, [isDragging]);

  const activePoiMarkerImageIndex = useMemo(() => {
    if (!poiMarkers || poiMarkers.length === 0) return null;
    if (snapDistance <= 0) return null;
    const nearest = getNearestPoiMarker(currentDistance);
    if (!nearest) return null;
    return nearest.diff <= snapDistance ? nearest.marker.imageIndex : null;
  }, [currentDistance, getNearestPoiMarker, poiMarkers, snapDistance]);

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
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <ScrubberPoiMarkers
          poiMarkers={poiMarkers}
          totalDistance={totalDistance}
          onPoiClick={onPoiClick ?? (() => {})}
          activeMarkerImageIndex={activePoiMarkerImageIndex}
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

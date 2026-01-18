"use client";

import { useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { formatDistanceCompact } from "@/lib/formatters";
import type { PoiMarker } from "@/types";
import { ScrubberPoiMarkers } from "./ScrubberPoiMarkers";

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
  const [isDragging, setIsDragging] = useState(false);
  const [hoverDistance, setHoverDistance] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);

  const progress = totalDistance > 0 ? (currentDistance / totalDistance) * 100 : 0;

  const getDistanceFromEvent = useCallback(
    (e: React.MouseEvent | MouseEvent): number => {
      if (!trackRef.current) return 0;
      const rect = trackRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const percentage = x / rect.width;
      return percentage * totalDistance;
    },
    [totalDistance]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      onDragStart?.();

      const distance = getDistanceFromEvent(e);
      onSeek(distance);

      const handleMouseMove = (e: MouseEvent) => {
        const distance = getDistanceFromEvent(e);
        onSeek(distance);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        onDragEnd?.();
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [getDistanceFromEvent, onSeek, onDragStart, onDragEnd]
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
        className="relative h-12 bg-slate-800/80 backdrop-blur-md border-t border-slate-600 cursor-pointer"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <ScrubberPoiMarkers
          poiMarkers={poiMarkers}
          totalDistance={totalDistance}
          onPoiClick={onPoiClick ?? (() => {})}
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

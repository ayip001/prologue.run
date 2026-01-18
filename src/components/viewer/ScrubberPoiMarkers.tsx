"use client";

import type { PoiMarker } from "@/types";
import { PoiIcon } from "./PoiIcon";

interface ScrubberPoiMarkersProps {
  poiMarkers: PoiMarker[] | null | undefined;
  totalDistance: number;
  onPoiClick: (imageIndex: number) => void;
  markerSize?: number;
}

const STACK_GAP = 4;

export function ScrubberPoiMarkers({
  poiMarkers,
  totalDistance,
  onPoiClick,
  markerSize = 12,
}: ScrubberPoiMarkersProps) {
  if (!poiMarkers || poiMarkers.length === 0) return null;

  return (
    <div className="absolute inset-x-0 bottom-full mb-1">
      {poiMarkers.map((marker) => {
        const distanceRatio =
          totalDistance > 0 ? marker.distanceFromStart / totalDistance : 0;
        const left = `${Math.min(100, Math.max(0, distanceRatio * 100))}%`;

        return (
          <div
            key={`${marker.imageIndex}-${marker.distanceFromStart}`}
            className="absolute -translate-x-1/2"
            style={{ left }}
          >
            {marker.pois.map((type, index) => (
              <button
                key={`${marker.imageIndex}-${type}-${index}`}
                type="button"
                className="absolute pointer-events-auto"
                style={{
                  bottom: index * (markerSize + STACK_GAP),
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  onPoiClick(marker.imageIndex);
                }}
                onMouseDown={(event) => {
                  event.stopPropagation();
                }}
                aria-label={`Go to ${type} point of interest`}
              >
                <PoiIcon type={type} size={markerSize} />
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

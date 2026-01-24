"use client";

import type { PoiMarker } from "@/types";
import { POI_TYPES } from "@/types";
import { PoiIcon } from "./PoiIcon";
import { cn } from "@/lib/utils";

const POI_ORDER = POI_TYPES.reduce((acc, type, index) => {
  acc[type] = index;
  return acc;
}, {} as Record<string, number>);

interface ScrubberPoiMarkersProps {
  poiMarkers: PoiMarker[] | null | undefined;
  totalDistance: number;
  onPoiClick: (imageIndex: number) => void;
  markerSize?: number;
  activePoiImageIndex?: number | null;
}

const STACK_GAP = 4;

export function ScrubberPoiMarkers({
  poiMarkers,
  totalDistance,
  onPoiClick,
  markerSize = 24,
  activePoiImageIndex,
}: ScrubberPoiMarkersProps) {
  if (!poiMarkers || poiMarkers.length === 0) return null;

  return (
    <div className="absolute inset-x-0 bottom-full mb-1">
      {poiMarkers.map((marker) => {
        const distanceRatio =
          totalDistance > 0 ? marker.distanceFromStart / totalDistance : 0;
        const left = `${Math.min(100, Math.max(0, distanceRatio * 100))}%`;
        const isActiveMarker = marker.imageIndex === activePoiImageIndex;

        return (
          <div
            key={`${marker.imageIndex}-${marker.distanceFromStart}`}
            className="absolute -translate-x-1/2"
            style={{ left }}
          >
            {[...marker.pois]
              .sort((a, b) => POI_ORDER[a] - POI_ORDER[b])
              .map((type, index) => (
                <button
                  key={`${marker.imageIndex}-${type}-${index}`}
                  type="button"
                  style={{
                    // @ts-ignore
                    "--poi-bottom": `${index * (markerSize + STACK_GAP)}px`,
                    // @ts-ignore
                    "--poi-bottom-mobile": `${index * (8 + 4)}px`,
                  }}
                  className={cn(
                    "absolute -translate-x-1/2 pointer-events-auto transition-all",
                    "bottom-[var(--poi-bottom-mobile)] sm:bottom-[var(--poi-bottom)]"
                  )}
                  onClick={(event) => {
                    event.stopPropagation();
                    onPoiClick(marker.imageIndex);
                  }}
                  onMouseDown={(event) => {
                    event.stopPropagation();
                  }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                  }}
                  aria-label={`Go to ${type} point of interest`}
                >
                  <PoiIcon
                    type={type}
                    size={markerSize}
                    showEmojiOnMobile={isActiveMarker}
                    emphasized={isActiveMarker}
                  />
                </button>
              ))}
          </div>
        );
      })}
    </div>
  );
}

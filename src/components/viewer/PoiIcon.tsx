"use client";

import type { PoiType } from "@/types";
import { POI_CONFIG } from "@/lib/poi";
import { cn } from "@/lib/utils";

interface PoiIconProps {
  type: PoiType;
  size?: number;
  className?: string;
}

export function PoiIcon({ type, size = 16, className }: PoiIconProps) {
  const config = POI_CONFIG[type];

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full border border-white/40 shadow-sm leading-none flex-shrink-0",
        className
      )}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
        backgroundColor: config.color,
        fontSize: `${size * 0.7}px`,
      }}
      aria-label={config.label}
    >
      <span aria-hidden="true" className="flex items-center justify-center">
        {config.emoji}
      </span>
    </div>
  );
}

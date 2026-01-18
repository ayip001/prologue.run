"use client";

import type { PoiType } from "@/types";
import { POI_CONFIG } from "@/lib/poi";
import { cn } from "@/lib/utils";

interface PoiIconProps {
  type: PoiType;
  size?: number;
  className?: string;
}

export function PoiIcon({ type, size = 12, className }: PoiIconProps) {
  const config = POI_CONFIG[type];

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full border border-white/40 shadow-sm text-[10px] leading-none",
        className
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: config.color,
      }}
      aria-label={config.label}
    >
      <span aria-hidden="true">{config.emoji}</span>
    </div>
  );
}

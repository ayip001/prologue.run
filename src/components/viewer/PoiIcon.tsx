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
        "flex items-center justify-center rounded-full border border-slate-400/50 shadow-sm leading-none flex-shrink-0 transition-all",
        "w-2 h-2 sm:w-[var(--poi-size)] sm:h-[var(--poi-size)]",
        className
      )}
      style={{
        // @ts-ignore
        "--poi-size": `${size}px`,
        backgroundColor: config.color,
      }}
      aria-label={config.label}
    >
      <span
        aria-hidden="true"
        className="hidden sm:flex items-center justify-center"
        style={{ fontSize: `${size * 0.7}px` }}
      >
        {config.emoji}
      </span>
    </div>
  );
}

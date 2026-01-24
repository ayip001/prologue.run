"use client";

import type { PoiType } from "@/types";
import { POI_CONFIG } from "@/lib/poi";
import { cn } from "@/lib/utils";

interface PoiIconProps {
  type: PoiType;
  size?: number;
  className?: string;
  showEmojiOnMobile?: boolean;
  emphasized?: boolean;
}

export function PoiIcon({
  type,
  size = 16,
  className,
  showEmojiOnMobile = false,
  emphasized = false,
}: PoiIconProps) {
  const config = POI_CONFIG[type];

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full border border-slate-400/50 shadow-sm leading-none flex-shrink-0 transition-all",
        emphasized ? "w-[var(--poi-size)] h-[var(--poi-size)]" : "w-2 h-2 sm:w-[var(--poi-size)] sm:h-[var(--poi-size)]",
        emphasized && "shadow-lg",
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
        className={cn(
          "items-center justify-center",
          showEmojiOnMobile ? "flex" : "hidden sm:flex"
        )}
        style={{ fontSize: `${size * 0.7}px` }}
      >
        {config.emoji}
      </span>
    </div>
  );
}

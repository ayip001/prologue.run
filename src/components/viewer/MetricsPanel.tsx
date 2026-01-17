"use client";

import { Route, Mountain } from "lucide-react";
import { GlassPanel } from "@/components/shared/GlassPanel";
import { formatDistanceCompact, formatElevationCompact } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface MetricsPanelProps {
  distanceMeters: number;
  totalDistanceMeters: number;
  elevationM: number;
  className?: string;
}

export function MetricsPanel({
  distanceMeters,
  totalDistanceMeters,
  elevationM,
  className,
}: MetricsPanelProps) {
  return (
    <div className={cn("flex gap-2", className)}>
      {/* Distance */}
      <GlassPanel className="px-3 py-2 flex items-center gap-2">
        <Route className="h-4 w-4 text-coral" />
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-semibold text-white">
            {formatDistanceCompact(distanceMeters)}
          </span>
          <span className="text-xs text-slate-400">/</span>
          <span className="text-xs text-slate-400">
            {formatDistanceCompact(totalDistanceMeters)}
          </span>
          <span className="text-xs text-slate-400">km</span>
        </div>
      </GlassPanel>

      {/* Elevation */}
      <GlassPanel className="px-3 py-2 flex items-center gap-2">
        <Mountain className="h-4 w-4 text-golden" />
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-semibold text-white">
            {formatElevationCompact(elevationM)}
          </span>
          <span className="text-xs text-slate-400">m</span>
        </div>
      </GlassPanel>
    </div>
  );
}

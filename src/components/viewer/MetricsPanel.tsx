"use client";

import { Route, Mountain } from "lucide-react";
import { GlassPanel } from "@/components/shared/GlassPanel";
import { formatDistanceCompact, formatElevationCompact } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface MetricsPanelProps {
  distanceMeters: number;
  totalDistanceMeters: number;
  totalAscentM: number;
  className?: string;
}

export function MetricsPanel({
  distanceMeters,
  totalDistanceMeters,
  totalAscentM,
  className,
}: MetricsPanelProps) {
  return (
    <div className={cn("flex gap-2", className)}>
      {/* Distance */}
      <GlassPanel className="px-3 py-2 flex items-center gap-2">
        <Route className="h-4 w-4 text-coral" />
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-semibold dark:text-white light:text-slate-900">
            {formatDistanceCompact(distanceMeters)}
          </span>
          <span className="text-xs dark:text-slate-400 light:text-slate-500">/</span>
          <span className="text-xs dark:text-slate-400 light:text-slate-500">
            {formatDistanceCompact(totalDistanceMeters)}
          </span>
          <span className="text-xs dark:text-slate-400 light:text-slate-500">km</span>
        </div>
      </GlassPanel>

      {/* Total Ascent */}
      <GlassPanel className="px-3 py-2 flex items-center gap-2">
        <Mountain className="h-4 w-4 text-golden" />
        <div className="flex items-baseline gap-1">
          <span className="text-xs dark:text-slate-400 light:text-slate-500 mr-1">↑</span>
          <span className="text-lg font-semibold dark:text-white light:text-slate-900">
            {formatElevationCompact(totalAscentM)}
          </span>
          <span className="text-xs dark:text-slate-400 light:text-slate-500">m</span>
        </div>
      </GlassPanel>
    </div>
  );
}

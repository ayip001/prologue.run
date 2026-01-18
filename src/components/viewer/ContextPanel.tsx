"use client";

import { GlassPanel } from "@/components/shared/GlassPanel";
import { cn } from "@/lib/utils";

interface ContextPanelProps {
  raceName: string;
  waypointName: string | null;
  className?: string;
}

export function ContextPanel({
  raceName,
  waypointName,
  className,
}: ContextPanelProps) {
  return (
    <GlassPanel className={cn("px-4 py-3", className)}>
      <h1 className="text-lg font-semibold dark:text-white light:text-slate-900">{raceName}</h1>
      {waypointName && (
        <div className="flex items-center gap-2 mt-1">
          {/* Pulse dot */}
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-coral opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-coral" />
          </span>
          <span className="text-sm dark:text-slate-300 light:text-slate-600">{waypointName}</span>
        </div>
      )}
    </GlassPanel>
  );
}

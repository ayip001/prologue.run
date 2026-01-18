"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { ContextPanel } from "./ContextPanel";
import { MetricsPanel } from "./MetricsPanel";
import { cn } from "@/lib/utils";

interface ViewerHUDProps {
  raceName: string;
  distanceMeters: number;
  totalDistanceMeters: number;
  totalAscentM: number;
  waypointName: string | null;
  isVisible: boolean;
  className?: string;
}

export function ViewerHUD({
  raceName,
  distanceMeters,
  totalDistanceMeters,
  totalAscentM,
  waypointName,
  isVisible,
  className,
}: ViewerHUDProps) {
  return (
    <div
      className={cn(
        "absolute inset-x-0 top-0 z-30 pointer-events-none",
        "transition-opacity duration-300",
        isVisible ? "opacity-100" : "opacity-0",
        className
      )}
    >
      {/* HUD content */}
      <div className="relative px-4 pt-4 flex items-start justify-between">
        {/* Left side - Context & Metrics */}
        <div
          className="flex flex-col gap-2 pointer-events-auto"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Context panel */}
          <ContextPanel 
            raceName={raceName} 
            waypointName={waypointName} 
            className="hidden sm:block"
          />

          {/* Metrics */}
          <MetricsPanel
            distanceMeters={distanceMeters}
            totalDistanceMeters={totalDistanceMeters}
            totalAscentM={totalAscentM}
          />
        </div>

        {/* Right side - Close button */}
        <div
          className="pointer-events-auto"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Button 
            variant="ghost" 
            size="icon" 
            asChild
            className="rounded-full dark:bg-slate-900/40 light:bg-white/40 backdrop-blur-sm border dark:border-white/10 light:border-slate-200 dark:text-white light:text-slate-900 hover:bg-coral hover:text-white transition-all"
          >
            <Link href="/" aria-label="Close viewer">
              <X className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

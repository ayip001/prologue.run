"use client";

import { useMemo } from "react";
import type { ElevationProfile as ElevationProfileType } from "@/types";
import { cn } from "@/lib/utils";

interface ElevationProfileProps {
  profile: ElevationProfileType | null;
  currentDistance: number;
  onSeek?: (distance: number) => void;
  className?: string;
}

export function ElevationProfile({
  profile,
  currentDistance,
  onSeek,
  className,
}: ElevationProfileProps) {
  const pathD = useMemo(() => {
    if (!profile || profile.points.length === 0) return "";

    const { points, totalDistance, minElevation, maxElevation } = profile;
    const elevRange = maxElevation - minElevation || 1;
    const width = 100;
    const height = 100;
    const padding = 5;

    const scaledPoints = points.map((p) => ({
      x: (p.distance / totalDistance) * width,
      y: height - padding - ((p.elevation - minElevation) / elevRange) * (height - 2 * padding),
    }));

    // Create SVG path
    const pathParts = scaledPoints.map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      return `L ${p.x} ${p.y}`;
    });

    // Close the path for fill
    pathParts.push(`L ${width} ${height}`);
    pathParts.push(`L 0 ${height}`);
    pathParts.push("Z");

    return pathParts.join(" ");
  }, [profile]);

  const currentX = useMemo(() => {
    if (!profile || profile.totalDistance === 0) return 0;
    return (currentDistance / profile.totalDistance) * 100;
  }, [profile, currentDistance]);

  if (!profile || profile.points.length === 0) {
    return null;
  }

  return (
    <div className={cn("relative h-16 pointer-events-none", className)}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
      >
        <defs>
          <linearGradient id="elevationFill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FF6B6B" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#FF6B6B" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="elevationStroke" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FF6B6B" />
            <stop offset="100%" stopColor="#FFD166" />
          </linearGradient>
        </defs>

        {/* Filled area */}
        <path d={pathD} fill="url(#elevationFill)" />

        {/* Line */}
        <path
          d={pathD.replace(/L 100 100 L 0 100 Z$/, "")}
          fill="none"
          stroke="url(#elevationStroke)"
          strokeWidth="0.5"
        />

        {/* Current position marker */}
        <line
          x1={currentX}
          y1="0"
          x2={currentX}
          y2="100"
          stroke="white"
          strokeWidth="0.3"
          strokeDasharray="2 2"
        />
      </svg>
    </div>
  );
}

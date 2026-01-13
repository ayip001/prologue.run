"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Link as LinkIcon, Mountain, Route, Check } from "lucide-react";
import { useState } from "react";
import type { RaceCardData } from "@/types";
import { ElevationBars } from "./ElevationBars";
import { GoldBadge } from "./GoldBadge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatRaceDistance, formatElevationSummary } from "@/lib/formatters";

interface RaceCardProps {
  race: RaceCardData;
  className?: string;
}

export function RaceCard({ race, className }: RaceCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const url = `${window.location.origin}/race/${race.slug}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-white/10 bg-slate-900/80 transition-all duration-300 hover:bg-slate-900/90 hover:border-white/20 hover:shadow-xl hover:shadow-coral/5",
        className
      )}
    >
      {/* Card Image */}
      <div className="relative aspect-[16/10] overflow-hidden">
        {race.cardImageUrl ? (
          <Image
            src={race.cardImageUrl}
            alt={race.name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900" />
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent" />

        {/* Route SVG Overlay */}
        {race.routeSvgPath && (
          <div className="absolute inset-0 flex items-center justify-center opacity-40 group-hover:opacity-60 transition-opacity">
            {/* SVG would be loaded here */}
          </div>
        )}

        {/* Tier Badge */}
        {race.tier && (
          <GoldBadge tier={race.tier} className="absolute top-3 right-3" />
        )}

        {/* Elevation Bars */}
        {race.elevationBars && <ElevationBars bars={race.elevationBars} />}
      </div>

      {/* Card Content */}
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {race.flagEmoji && (
                <span className="text-lg">{race.flagEmoji}</span>
              )}
              <h3 className="text-lg font-semibold text-white group-hover:text-gradient transition-colors">
                {race.name}
              </h3>
            </div>
            {race.city && race.country && (
              <p className="text-sm text-slate-400">
                {race.city}, {race.country}
              </p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mb-4 text-sm text-slate-400">
          <div className="flex items-center gap-1.5">
            <Route className="h-4 w-4" />
            <span>{formatRaceDistance(race.distanceMeters)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Mountain className="h-4 w-4" />
            <span>
              {formatElevationSummary(race.elevationGain, race.elevationLoss)}
            </span>
          </div>
        </div>

        {/* Recorded By */}
        {race.recordedBy && race.recordedYear && (
          <p className="text-xs text-slate-500 mb-4">
            Recorded by {race.recordedBy} ({race.recordedYear})
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Link href={`/race/${race.slug}`} className="flex-1">
            <Button className="w-full group/btn">
              View Route
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
            </Button>
          </Link>
          <Button
            variant="secondary"
            size="icon"
            onClick={handleCopyLink}
            className="shrink-0"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-400" />
            ) : (
              <LinkIcon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

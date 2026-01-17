"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Link as LinkIcon, Mountain, Route } from "lucide-react";
import { useEffect, useRef } from "react";
import type { RaceCardData } from "@/types";
import { GoldBadge } from "./GoldBadge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatRaceDistance, formatElevationSummary } from "@/lib/formatters";
import { getMinimapUrl } from "@/lib/imageUrl";

interface RaceCardProps {
  race: RaceCardData;
  className?: string;
}

export function RaceCard({ race, className }: RaceCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<HTMLDivElement>(null);
  const rotationRef = useRef({ angle: 0, animationId: null as number | null, isHovering: false });

  useEffect(() => {
    const card = cardRef.current;
    const path = pathRef.current;
    if (!card || !path) return;

    const animate = () => {
      if (!rotationRef.current.isHovering) return;

      rotationRef.current.angle += 1;
      path.style.transform = `rotateZ(${rotationRef.current.angle}deg)`;
      rotationRef.current.animationId = requestAnimationFrame(animate);
    };

    const handleMouseEnter = () => {
      rotationRef.current.isHovering = true;
      
      // Sync starting angle with current computed style to prevent jumps
      const style = window.getComputedStyle(path);
      const matrix = new DOMMatrix(style.transform);
      const currentRotation = Math.atan2(matrix.b, matrix.a) * (180 / Math.PI);
      rotationRef.current.angle = currentRotation;
      
      path.style.transition = 'none';
      animate();
    };

    const handleMouseLeave = () => {
      rotationRef.current.isHovering = false;
      if (rotationRef.current.animationId) {
        cancelAnimationFrame(rotationRef.current.animationId);
      }

      // Snap to nearest upright position (multiple of 360)
      const rounds = Math.round(rotationRef.current.angle / 360);
      const targetAngle = rounds * 360;
      
      path.style.transition = 'transform 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      rotationRef.current.angle = targetAngle;
      
      requestAnimationFrame(() => {
        path.style.transform = `rotateZ(${targetAngle}deg)`;
      });
    };

    card.addEventListener('mouseenter', handleMouseEnter);
    card.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      card.removeEventListener('mouseenter', handleMouseEnter);
      card.removeEventListener('mouseleave', handleMouseLeave);
      if (rotationRef.current.animationId) {
        cancelAnimationFrame(rotationRef.current.animationId);
      }
    };
  }, []);

  const minimapUrl = race.minimapUrl?.startsWith("/") 
    ? race.minimapUrl 
    : getMinimapUrl(race.slug, race.minimapUrl);

  return (
    <div
      ref={cardRef}
      className={cn(
        "group relative overflow-hidden rounded-xl border transition-all duration-500 hover:border-coral/50 hover:shadow-xl hover:shadow-coral/5",
        "dark:border-white/10 dark:bg-slate-900/80 dark:hover:bg-slate-900/90",
        "light:border-slate-200 light:bg-slate-100 light:hover:bg-slate-50",
        "perspective-1000",
        className
      )}
    >
      <style jsx>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        .preserve-3d {
          transform-style: preserve-3d;
        }
        .pitch-wrapper {
          transition: transform 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        .group:hover .pitch-wrapper {
          transform: scale(1.1) rotateX(60deg);
        }
      `}</style>

      {/* Card Image */}
      <div className="relative aspect-[16/10] overflow-hidden dark:bg-slate-950 light:bg-slate-200">
        {race.cardImageUrl ? (
          <Image
            src={race.cardImageUrl}
            alt={race.name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-all duration-700 opacity-60 group-hover:opacity-40 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br dark:from-slate-800 dark:to-slate-900 light:from-slate-200 light:to-slate-300 opacity-70 group-hover:opacity-60 transition-opacity duration-700" />
        )}

        {/* Route Path Overlay */}
        {minimapUrl && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-8 preserve-3d">
            <div className="relative w-full h-full pitch-wrapper preserve-3d">
              <div 
                ref={pathRef}
                className="relative w-full h-full opacity-60 group-hover:opacity-100 transition-opacity duration-500"
              >
                <Image
                  src={minimapUrl}
                  alt="Route Map"
                  fill
                  className="object-contain"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tier Badge */}
        {race.tier && (
          <GoldBadge tier={race.tier} className="absolute top-3 right-3" />
        )}
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
              <h3 className="text-lg font-semibold dark:text-white light:text-slate-900">
                {race.name}
              </h3>
            </div>
            {race.city && race.country && (
              <p className="text-sm dark:text-slate-400 light:text-slate-600">
                {race.city}, {race.country}
              </p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mb-4 text-sm dark:text-slate-400 light:text-slate-600">
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
          <p className="text-xs dark:text-slate-500 light:text-slate-500 mb-4">
            Recorded by {race.recordedBy} ({race.recordedYear})
          </p>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2">
          <Link href={`/race/${race.slug}`}>
            <Button className="w-full group/btn">
              View Route
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
            </Button>
          </Link>
          
          <a 
            href={race.officialUrl || "#"} 
            target="_blank" 
            rel="noopener noreferrer"
          >
            <Button
              variant="secondary"
              className="w-full gap-2"
            >
              <LinkIcon className="h-4 w-4" />
              Official Site
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}

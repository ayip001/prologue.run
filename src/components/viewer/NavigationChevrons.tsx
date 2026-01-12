"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavigationChevronsProps {
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
  className?: string;
}

export function NavigationChevrons({
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
  className,
}: NavigationChevronsProps) {
  return (
    <>
      {/* Previous button */}
      <button
        onClick={onPrevious}
        disabled={!hasPrevious}
        className={cn(
          "absolute left-4 top-1/2 -translate-y-1/2 z-20",
          "w-12 h-12 rounded-full",
          "bg-slate-800/70 backdrop-blur-md border border-white/10",
          "flex items-center justify-center",
          "transition-all duration-200",
          "hover:bg-slate-700/80 hover:scale-105",
          "disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100",
          className
        )}
        aria-label="Previous image"
      >
        <ChevronLeft className="h-6 w-6 text-white" />
      </button>

      {/* Next button */}
      <button
        onClick={onNext}
        disabled={!hasNext}
        className={cn(
          "absolute right-4 top-1/2 -translate-y-1/2 z-20",
          "w-12 h-12 rounded-full",
          "bg-slate-800/70 backdrop-blur-md border border-white/10",
          "flex items-center justify-center",
          "transition-all duration-200",
          "hover:bg-slate-700/80 hover:scale-105",
          "disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100",
          className
        )}
        aria-label="Next image"
      >
        <ChevronRight className="h-6 w-6 text-white" />
      </button>
    </>
  );
}

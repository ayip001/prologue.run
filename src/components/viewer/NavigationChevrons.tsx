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
          "dark:bg-slate-900/40 light:bg-white/40 backdrop-blur-sm border dark:border-white/10 light:border-slate-200",
          "flex items-center justify-center",
          "transition-all duration-200",
          "dark:text-white light:text-slate-900 hover:bg-coral hover:text-white hover:scale-105",
          "disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:bg-transparent",
          className
        )}
        aria-label="Previous image"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>

      {/* Next button */}
      <button
        onClick={onNext}
        disabled={!hasNext}
        className={cn(
          "absolute right-4 top-1/2 -translate-y-1/2 z-20",
          "w-12 h-12 rounded-full",
          "dark:bg-slate-900/40 light:bg-white/40 backdrop-blur-sm border dark:border-white/10 light:border-slate-200",
          "flex items-center justify-center",
          "transition-all duration-200",
          "dark:text-white light:text-slate-900 hover:bg-coral hover:text-white hover:scale-105",
          "disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:bg-transparent",
          className
        )}
        aria-label="Next image"
      >
        <ChevronRight className="h-6 w-6" />
      </button>
    </>
  );
}

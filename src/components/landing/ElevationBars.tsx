import { cn } from "@/lib/utils";

interface ElevationBarsProps {
  /** Array of height percentages (0-100), typically 30-40 values */
  bars: number[];
  className?: string;
}

/**
 * Renders a series of vertical bars representing elevation profile.
 * Used as background decoration on race cards.
 */
export function ElevationBars({ bars, className }: ElevationBarsProps) {
  if (!bars || bars.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute bottom-0 left-0 right-0 h-20 flex items-end gap-px opacity-20 pointer-events-none",
        className
      )}
    >
      {bars.map((height, i) => (
        <div
          key={i}
          className="flex-1 bg-white rounded-t-[1px] transition-all duration-300"
          style={{ height: `${Math.max(5, Math.min(100, height))}%` }}
        />
      ))}
    </div>
  );
}

"use client";

import { useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { POI_CONFIG } from "@/lib/poi";
import { cn } from "@/lib/utils";
import { GlassPanel } from "@/components/shared/GlassPanel";
import type { PoiType } from "@/types";

interface PoiLegendProps {
  activeTypes: PoiType[];
}

export function PoiLegend({ activeTypes }: PoiLegendProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (activeTypes.length === 0) return null;

  return (
    <div className="sm:hidden absolute left-4 bottom-14 z-40">
      {/* Legend Panel */}
      {isOpen && (
        <GlassPanel className="mb-2 p-3 w-40 shadow-xl animate-in fade-in slide-in-from-bottom-2 relative">
          <button 
            onClick={() => setIsOpen(false)}
            className="absolute top-2 right-2 text-slate-400 hover:dark:text-white hover:light:text-slate-900"
          >
            <X size={12} />
          </button>
          <div className="space-y-2">
            {activeTypes.map((type) => {
              const config = POI_CONFIG[type];
              return (
                <div key={type} className="flex items-center gap-2">
                  <div 
                    className="w-2 h-2 rounded-full border border-slate-400/50"
                    style={{ backgroundColor: config.color }}
                  />
                  <span className="text-xs dark:text-white/90 light:text-slate-900">{config.label}</span>
                </div>
              );
            })}
          </div>
        </GlassPanel>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-lg border",
          isOpen 
            ? "bg-coral text-white border-coral" 
            : "dark:bg-slate-800/80 dark:text-slate-300 dark:border-white/20 light:bg-white light:text-slate-600 light:border-slate-200 backdrop-blur-md"
        )}
        aria-label="Show route legend"
      >
        <HelpCircle size={18} />
      </button>
    </div>
  );
}

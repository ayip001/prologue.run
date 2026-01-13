import { Plus, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AddRouteCardProps {
  className?: string;
}

export function AddRouteCard({ className }: AddRouteCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/90 transition-all duration-300 hover:border-coral/50 hover:bg-slate-900/95",
        className
      )}
    >
      <div className="flex flex-col items-center justify-center h-full min-h-[280px] p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-4">
          <Plus className="h-6 w-6 text-coral" />
        </div>

        <h3 className="text-lg font-semibold text-white mb-2">
          Add Your Race
        </h3>
        <p className="text-sm text-slate-400 mb-6 max-w-[200px]">
          Have a race you'd like to see? Let us know!
        </p>

        <Button variant="secondary" asChild>
          <a href="mailto:hello@prologue.run?subject=Race%20Request">
            <Mail className="mr-2 h-4 w-4" />
            Request Race
          </a>
        </Button>
      </div>
    </div>
  );
}

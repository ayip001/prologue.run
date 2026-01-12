import { cn } from "@/lib/utils";
import { Award, Star, Medal } from "lucide-react";

interface GoldBadgeProps {
  tier: "gold" | "silver" | "bronze";
  className?: string;
}

const tierConfig = {
  gold: {
    bg: "bg-amber-500/20",
    border: "border-amber-500/50",
    text: "text-amber-400",
    label: "Gold",
    Icon: Award,
  },
  silver: {
    bg: "bg-slate-400/20",
    border: "border-slate-400/50",
    text: "text-slate-300",
    label: "Silver",
    Icon: Star,
  },
  bronze: {
    bg: "bg-orange-700/20",
    border: "border-orange-700/50",
    text: "text-orange-500",
    label: "Bronze",
    Icon: Medal,
  },
};

export function GoldBadge({ tier, className }: GoldBadgeProps) {
  const config = tierConfig[tier];
  const Icon = config.Icon;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border",
        config.bg,
        config.border,
        config.text,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </div>
  );
}

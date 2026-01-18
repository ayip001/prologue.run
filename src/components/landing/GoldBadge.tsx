import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface GoldBadgeProps {
  tier: "gold" | "silver" | "bronze";
  className?: string;
}

const tierConfig = {
  gold: {
    bg: "bg-amber-500/80",
    border: "border-amber-500/50",
    text: "text-white",
    key: "gold",
  },
  silver: {
    bg: "bg-slate-400/80",
    border: "border-slate-400/50",
    text: "text-white",
    key: "silver",
  },
  bronze: {
    bg: "bg-orange-700/80",
    border: "border-orange-700/50",
    text: "text-white",
    key: "bronze",
  },
};

export function GoldBadge({ tier, className }: GoldBadgeProps) {
  const t = useTranslations("tiers");
  const config = tierConfig[tier];

  return (
    <div
      className={cn(
        "inline-flex items-center px-3 py-1.5 rounded-none rounded-bl-xl text-[10px] font-bold uppercase tracking-wider border-l border-b backdrop-blur-sm",
        config.bg,
        config.border,
        config.text,
        className
      )}
    >
      {t(config.key)}
    </div>
  );
}

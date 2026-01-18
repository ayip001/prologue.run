import type { PoiType } from "@/types";

export const POI_CONFIG: Record<
  PoiType,
  { label: string; color: string; emoji: string }
> = {
  toilet: { label: "Toilet", color: "#3B82F6", emoji: "🚻" },
  checkpoint: { label: "Checkpoint", color: "#8B5CF6", emoji: "🏁" },
  water: { label: "Water", color: "#9ffcdf", emoji: "💧" },
  "energy-drink": { label: "Energy Drink", color: "#EAB308", emoji: "⚡" },
  food: { label: "Food", color: "#F97316", emoji: "🍌" },
  "first-aid": { label: "First Aid", color: "#FFFFFF", emoji: "🚑" },
  "scenic-spot": { label: "Scenic Spot", color: "#ef5d60", emoji: "📷" },
  "warning-spot": { label: "Warning Spot", color: "#F59E0B", emoji: "⚠️" },
  "cheer-zone": { label: "Cheer Zone", color: "#EC4899", emoji: "🎉" },
};

export const POI_MAX_PER_IMAGE = 10;

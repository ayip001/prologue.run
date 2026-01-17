// CDN and storage configuration
export const CDN_BASE_URL =
  process.env.NEXT_PUBLIC_CDN_BASE_URL || "https://images.prologue.run";

// Testing card configuration
export const ENABLE_TESTING_CARD = true;

export const TEST_CARD_DATA = {
  id: "test-route",
  slug: "test-route",
  name: "Test Route",
  flagEmoji: "🧪",
  recordedYear: 2024,
  recordedBy: "Developer",
  distanceMeters: 42195,
  elevationGain: 500,
  elevationLoss: 480,
  city: "Test City",
  country: "Testland",
  tier: "bronze" as const,
  cardImageUrl: "https://images.unsplash.com/photo-1672182701054-20654f8f52cd?q=80&w=700",
  minimapUrl: "https://images.prologue.run/races/test-route-02/public/minimap.webp",
  elevationBars: [30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25, 30, 35, 40, 45, 50, 55, 60, 65],
  totalImages: 1,
  officialUrl: "https://www.worldmarathonmajors.com/",
};

export const TEST_VIEWER_IMAGE_URL = "https://upload.wikimedia.org/wikipedia/commons/5/50/Alcazar_de_Toledo_y_Academia_de_Infanter%C3%ADa.jpg";

// Default view state values
export const DEFAULT_VIEW = {
  heading: 0,
  pitch: 0,
  fov: 90,
} as const;

// Camera constraints
export const CAMERA_CONSTRAINTS = {
  minFov: 50,
  maxFov: 90,
  minPitch: -90,
  maxPitch: 90,
  zoomSensitivity: 0.05,
  doubleTapDelayMs: 300,
} as const;

// Image tiers configuration
export const IMAGE_TIERS = {
  thumbnail: { width: 512, label: "Preview" },
  medium: { width: 2048, label: "Standard" },
  full: { width: 4096, label: "High Quality" },
} as const;

// Preload settings
export const PRELOAD_SETTINGS = {
  // Number of images to preload ahead and behind current position
  preloadAhead: 3,
  preloadBehind: 1,
  // Delay before upgrading from thumbnail to medium quality
  upgradeDelayMs: 100,
  // Delay before upgrading to full high quality
  fullUpgradeDelayMs: 1500,
} as const;

// URL update debounce
export const URL_UPDATE_DEBOUNCE_MS = 300;

// Race tier colors
export const TIER_COLORS = {
  gold: {
    bg: "bg-amber-500/20",
    border: "border-amber-500/50",
    text: "text-amber-400",
  },
  silver: {
    bg: "bg-slate-400/20",
    border: "border-slate-400/50",
    text: "text-slate-300",
  },
  bronze: {
    bg: "bg-orange-700/20",
    border: "border-orange-700/50",
    text: "text-orange-500",
  },
} as const;

// Route distance labels
export function getDistanceLabels(totalDistanceM: number): Array<{ distance: number; label: string }> {
  const labels: Array<{ distance: number; label: string }> = [];
  const stepM = totalDistanceM > 30000 ? 10000 : 5000;

  for (let d = 0; d <= totalDistanceM; d += stepM) {
    labels.push({ distance: d, label: `${d / 1000}km` });
  }

  // Always include final distance if not already there
  if (labels[labels.length - 1].distance !== totalDistanceM) {
    labels.push({
      distance: totalDistanceM,
      label: `${(totalDistanceM / 1000).toFixed(1)}km`,
    });
  }

  return labels;
}

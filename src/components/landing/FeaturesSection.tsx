import { Camera, Eye, Map, Zap } from "lucide-react";
import { GlassPanel } from "@/components/shared/GlassPanel";

const features = [
  {
    icon: Eye,
    title: "360° Street View",
    description:
      "Immerse yourself in the race route with full panoramic imagery captured from the runner's perspective.",
  },
  {
    icon: Map,
    title: "Full Route Coverage",
    description:
      "Every kilometer covered, from start to finish. No gaps, no surprises on race day.",
  },
  {
    icon: Camera,
    title: "High Quality",
    description:
      "Captured with professional 360° cameras for crystal-clear detail in any direction.",
  },
  {
    icon: Zap,
    title: "Fast & Smooth",
    description:
      "Optimized loading with progressive image quality for a seamless viewing experience.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 bg-slate-900/50">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Why Prologue?
          </h2>
          <p className="text-slate-400 max-w-lg mx-auto">
            Know the course before you run it. Mental preparation is half the battle.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <GlassPanel key={feature.title} className="p-6">
              <feature.icon className="h-10 w-10 text-coral mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-slate-400">{feature.description}</p>
            </GlassPanel>
          ))}
        </div>
      </div>
    </section>
  );
}

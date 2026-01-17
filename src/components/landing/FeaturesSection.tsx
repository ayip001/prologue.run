import { Camera, Eye, Map, Zap } from "lucide-react";
import { GlassPanel } from "@/components/shared/GlassPanel";

const features = [
  {
    icon: Eye,
    title: "360° Street View",
    description:
      "Never ran this marathon before? Immerse yourself in the race route from the runner's perspective.",
  },
  {
    icon: Camera,
    title: "Full Route Coverage",
    description:
      "Every kilometer covered, from start to finish. Never take a wrong turn. No surprises on race day.",
  },
  {
    icon: Map,
    title: "Race Details",
    description:
      "Prepare yourself for the race with detailed elevation profiles and distance markers.",
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
    <section id="features" className="py-20 dark:bg-slate-900/50 light:bg-slate-100">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold dark:text-white light:text-slate-900 mb-4">
            Why Prologue?
          </h2>
          <p className="dark:text-slate-400 light:text-slate-600 max-w-lg mx-auto">
            Know the course before you run it. Mental preparation is half the battle.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <GlassPanel key={feature.title} className="p-6">
              <feature.icon className="h-10 w-10 text-coral mb-4" />
              <h3 className="text-lg font-semibold dark:text-white light:text-slate-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-sm dark:text-slate-400 light:text-slate-600">{feature.description}</p>
            </GlassPanel>
          ))}
        </div>
      </div>
    </section>
  );
}

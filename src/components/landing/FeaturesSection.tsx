"use client";

import { useTranslations } from "next-intl";
import { Camera, Eye, Map, Zap } from "lucide-react";
import { GlassPanel } from "@/components/shared/GlassPanel";

export function FeaturesSection() {
  const t = useTranslations("features");

  const features = [
    {
      icon: Eye,
      titleKey: "streetView.title" as const,
      descriptionKey: "streetView.description" as const,
    },
    {
      icon: Camera,
      titleKey: "fullRoute.title" as const,
      descriptionKey: "fullRoute.description" as const,
    },
    {
      icon: Map,
      titleKey: "raceDetails.title" as const,
      descriptionKey: "raceDetails.description" as const,
    },
    {
      icon: Zap,
      titleKey: "fastSmooth.title" as const,
      descriptionKey: "fastSmooth.description" as const,
    },
  ];

  return (
    <section id="features" className="py-20 dark:bg-slate-900/50 light:bg-slate-100">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold dark:text-white light:text-slate-900 mb-4">
            {t("title")}
          </h2>
          <p className="dark:text-slate-400 light:text-slate-600 max-w-lg mx-auto">
            {t("subtitle")}
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <GlassPanel key={feature.titleKey} className="p-6">
              <feature.icon className="h-10 w-10 text-coral mb-4" />
              <h3 className="text-lg font-semibold dark:text-white light:text-slate-900 mb-2">
                {t(feature.titleKey)}
              </h3>
              <p className="text-sm dark:text-slate-400 light:text-slate-600">
                {t(feature.descriptionKey)}
              </p>
            </GlassPanel>
          ))}
        </div>
      </div>
    </section>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { GradientText } from "@/components/shared/GradientText";
import { GlobeBackground } from "./GlobeBackground";
import { RaceCard } from "./RaceCard";
import { AddRouteCard } from "./AddRouteCard";
import { ENABLE_TESTING_CARDS, TEST_CARD_DATA } from "@/lib/constants";
import type { RaceCardData } from "@/types";
import { Link } from "@/i18n/navigation";

interface HeroSectionProps {
  races: RaceCardData[];
}

export function HeroSection({ races }: HeroSectionProps) {
  const t = useTranslations("hero");
  const allRaces = ENABLE_TESTING_CARDS ? [TEST_CARD_DATA, ...races] : races;

  return (
    <section className="relative min-h-screen pt-32 pb-20 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 light:from-white light:via-slate-50 light:to-white z-0" />

      {/* Three.js globe overlay */}
      <GlobeBackground />

      {/* Hero Content */}
      <div className="relative z-10 container mx-auto px-4 text-center mb-16">
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6">
          <span className="dark:text-white light:text-slate-900">{t("title")}</span>
          <GradientText>{t("titleHighlight")}</GradientText>
        </h1>

        <p className="text-lg md:text-xl dark:text-slate-400 light:text-slate-600 max-w-2xl mx-auto mb-10">
          {t("description")}
        </p>
      </div>

      {/* Race Grid Integrated */}
      <div id="races" className="relative z-10 container mx-auto px-4">
        <div className="flex flex-wrap justify-center gap-6">
          {allRaces.map((race) => (
            <RaceCard
              key={race.id}
              race={race}
              className="w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] max-w-sm"
            />
          ))}
          <AddRouteCard className="w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] max-w-sm" />
        </div>
      </div>

      {/* Buttons */}
      <div className="relative z-10 container mx-auto px-4 text-center mt-12 mb-12">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            size="lg"
            asChild
            className="!opacity-60 cursor-default group relative min-w-[200px]"
          >
            <a href="#" onClick={(e) => e.preventDefault()}>
              <span className="group-hover:hidden">{t("browseMoreRaces")}</span>
              <span className="hidden group-hover:inline">{t("comingSoon")}</span>
            </a>
          </Button>
          <Button
            variant="secondary"
            size="lg"
            asChild
            className="light:bg-white light:hover:bg-slate-50 light:border-slate-200"
          >
            <Link href="#features">{t("learnMore")}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

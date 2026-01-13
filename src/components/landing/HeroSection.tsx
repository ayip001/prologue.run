import { Button } from "@/components/ui/button";
import { GradientText } from "@/components/shared/GradientText";
import { GlobeBackground } from "./GlobeBackground";
import { RaceCard } from "./RaceCard";
import { AddRouteCard } from "./AddRouteCard";
import { ENABLE_TESTING_CARD, TEST_CARD_DATA } from "@/lib/constants";
import type { RaceCardData } from "@/types";

interface HeroSectionProps {
  races: RaceCardData[];
}

export function HeroSection({ races }: HeroSectionProps) {
  const allRaces = ENABLE_TESTING_CARD ? [TEST_CARD_DATA, ...races] : races;

  return (
    <section className="relative min-h-screen pt-32 pb-20 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 z-0" />

      {/* Three.js globe overlay */}
      <GlobeBackground />

      {/* Hero Content */}
      <div className="relative z-10 container mx-auto px-4 text-center mb-16">
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6">
          <span className="text-white">Scout Your </span>
          <GradientText>Next Race</GradientText>
        </h1>

        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10">
          Preview marathon routes through interactive 360° street-level imagery.
          Know exactly what to expect before race day.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button size="lg" asChild>
            <a href="#races">
              Browse Races
            </a>
          </Button>
          <Button variant="secondary" size="lg" asChild>
            <a href="#features">Learn More</a>
          </Button>
        </div>
      </div>

      {/* Race Grid Integrated */}
      <div id="races" className="relative z-10 container mx-auto px-4">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {allRaces.map((race) => (
            <RaceCard key={race.id} race={race} />
          ))}
          <AddRouteCard />
        </div>
      </div>
    </section>
  );
}

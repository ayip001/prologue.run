import type { RaceCardData } from "@/types";
import { RaceCard } from "./RaceCard";
import { AddRouteCard } from "./AddRouteCard";
import { ENABLE_TESTING_CARD, TEST_CARD_DATA } from "@/lib/constants";

interface RaceGridProps {
  races: RaceCardData[];
}

export function RaceGrid({ races }: RaceGridProps) {
  const allRaces = ENABLE_TESTING_CARD ? [TEST_CARD_DATA, ...races] : races;

  return (
    <section id="races" className="py-20 bg-slate-950">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Available Races
          </h2>
          <p className="text-slate-400 max-w-lg mx-auto">
            Explore our collection of marathon routes captured in stunning 360° detail.
          </p>
        </div>

        {/* Grid */}
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

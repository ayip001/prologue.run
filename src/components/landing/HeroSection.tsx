import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GradientText } from "@/components/shared/GradientText";
import { GlobeBackground } from "./GlobeBackground";

export function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 z-0" />

      {/* Three.js globe overlay */}
      <GlobeBackground />

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 text-center">
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6">
          <span className="text-white">Scout Your </span>
          <GradientText>Next Race</GradientText>
        </h1>

        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-8">
          Preview marathon routes through interactive 360° street-level imagery.
          Know exactly what to expect before race day.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <Button size="lg" asChild>
            <a href="#races">
              Browse Races
              <ArrowDown className="ml-2 h-4 w-4" />
            </a>
          </Button>
          <Button variant="secondary" size="lg" asChild>
            <a href="#about">Learn More</a>
          </Button>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap justify-center gap-8 md:gap-16">
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold text-gradient">360°</div>
            <div className="text-sm text-slate-400 mt-1">Street View</div>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold text-white">HD</div>
            <div className="text-sm text-slate-400 mt-1">Quality Images</div>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold text-white">Free</div>
            <div className="text-sm text-slate-400 mt-1">Forever</div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <ArrowDown className="h-6 w-6 text-slate-500" />
      </div>
    </section>
  );
}

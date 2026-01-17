"use client";

import { useEffect, useState, useRef } from "react";

export function StorySection() {
  const [opacity, setOpacity] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return;
      
      const rect = sectionRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      
      // Start and finish fading at certain percentage of the viewport height
      const start = viewportHeight * 0.2; 
      const end = viewportHeight * 0.4;
      
      const current = rect.top;
      
      let progress = (start - current) / (start - end);
      progress = Math.max(0, Math.min(1, progress));
      
      setOpacity(progress);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    // Run once on mount to set initial state
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section ref={sectionRef} className="py-24 bg-slate-950">
      <div className="container mx-auto px-4">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          {/* Left Text */}
          <div className="flex-1 space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              About Prologue.run
            </h2>
            <p className="text-lg text-slate-400 leading-relaxed">
              Hi, I'm Angus, an avid runner and developer.
            </p>
            <p className="text-lg text-slate-400 leading-relaxed">
              Like many other runners, I enjoy running marathons outside of my hometown,
              and I sometimes just wish to see the route before running it (like
              reading the prologue for a book!). Then I noticed my 360 camera
              that's been gathering dust, and that's how this idea came to be.
            </p>
            <p className="text-lg text-slate-400 leading-relaxed">
              Prologue.run allows you to preview the route of a race before you run it,
              like using Google Maps' Street View feature. Right now, the selection of races is limited
              to races that I have run, but I plan to add more races in the future as I complete more races.
              If you have a race that you would like to see on Prologue.run, or if you want to help log a race,
              please let me know by emailing me at&nbsp;
              <a href="mailto:hello@prologue.run" className="text-coral hover:underline">hello@prologue.run</a>.
            </p>
          </div>

          {/* Right Image Stack */}
          <div className="flex-1 relative aspect-[2/3] max-w-md w-full mx-auto">
            {/* Base Image */}
            <div className="relative w-full h-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
              <picture>
                <source srcSet="/prologue-run-about.avif" type="image/avif" />
                <img
                  src="/prologue-run-about.jpg"
                  alt="About Prologue base"
                  className="w-full h-full object-cover"
                />
              </picture>
            </div>

            {/* Overlay Image */}
            <div 
              className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none"
              style={{ opacity }}
            >
              <picture>
                <source srcSet="/prologue-run-about-overlay.avif" type="image/avif" />
                <img
                  src="/prologue-run-about-overlay.jpg"
                  alt="About Prologue overlay"
                  className="w-full h-full object-cover"
                />
              </picture>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

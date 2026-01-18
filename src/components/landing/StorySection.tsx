"use client";

import { useEffect, useState, useRef } from "react";
import { useTranslations } from "next-intl";

export function StorySection() {
  const [opacity, setOpacity] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("story");

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
    <section ref={sectionRef} className="py-24 dark:bg-slate-950 light:bg-white">
      <div className="container mx-auto px-4">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          {/* Left Text */}
          <div className="flex-1 space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold dark:text-white light:text-slate-900">
              {t("title")}
            </h2>
            <p className="text-lg dark:text-slate-400 light:text-slate-600 leading-relaxed">
              {t("paragraph1")}
            </p>
            <p className="text-lg dark:text-slate-400 light:text-slate-600 leading-relaxed">
              {t("paragraph2")}
            </p>
            <p className="text-lg dark:text-slate-400 light:text-slate-600 leading-relaxed">
              {t("paragraph3")}&nbsp;
              <a
                href="mailto:hello@prologue.run"
                className="text-coral hover:underline"
              >
                hello@prologue.run
              </a>
              .
            </p>
          </div>

          {/* Right Image Stack */}
          <div className="flex-1 relative aspect-[2/3] max-w-md w-full mx-auto">
            {/* Base Image */}
            <div className="relative w-full h-full rounded-2xl overflow-hidden border dark:border-white/10 light:border-slate-200 shadow-2xl">
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

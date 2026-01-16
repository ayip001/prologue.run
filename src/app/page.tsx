import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { StorySection } from "@/components/landing/StorySection";
import { MethodologySection } from "@/components/landing/MethodologySection";
import { ContactSection } from "@/components/landing/ContactSection";
import { getAllRaces } from "@/lib/db";
import type { RaceCardData } from "@/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Fetch races from database
  let races: RaceCardData[];
  try {
    races = await getAllRaces();
  } catch (error) {
    console.error("HOMEPAGE FETCH ERROR:", error);
    // If database is not available, use empty array
    races = [];
  }

  return (
    <>
      <Navbar transparent />
      <main>
        <HeroSection races={races} />
        <FeaturesSection />
        <StorySection />
        <MethodologySection />
        <ContactSection />
      </main>
      <Footer />
    </>
  );
}

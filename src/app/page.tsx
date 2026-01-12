import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { HeroSection } from "@/components/landing/HeroSection";
import { RaceGrid } from "@/components/landing/RaceGrid";
import { AboutSection } from "@/components/landing/AboutSection";
import { getAllRaces } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Fetch races from database
  let races;
  try {
    races = await getAllRaces();
  } catch {
    // If database is not available, use empty array
    races = [];
  }

  return (
    <>
      <Navbar transparent />
      <main>
        <HeroSection />
        <RaceGrid races={races} />
        <AboutSection />
      </main>
      <Footer />
    </>
  );
}

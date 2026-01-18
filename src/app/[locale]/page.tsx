import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { StorySection } from "@/components/landing/StorySection";
import { MethodologySection } from "@/components/landing/MethodologySection";
import { FAQSection } from "@/components/landing/FAQSection";
import { ContactSection } from "@/components/landing/ContactSection";
import { getAllRaces } from "@/lib/db";
import type { RaceCardData } from "@/types";
import type { Locale } from "@/i18n/config";
import { locales, defaultLocale } from "@/i18n/config";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });

  const baseUrl = "https://prologue.run";
  const canonicalUrl = locale === defaultLocale ? baseUrl : `${baseUrl}/${locale}`;

  return {
    title: t("title"),
    description: t("description"),
    keywords: t("keywords").split(", "),
    authors: [{ name: "prologue.run" }],
    alternates: {
      canonical: canonicalUrl,
      languages: Object.fromEntries(
        locales.map((l) => [
          l === "zh-hk" ? "zh-Hant-HK" : l,
          l === defaultLocale ? baseUrl : `${baseUrl}/${l}`,
        ])
      ),
    },
    openGraph: {
      title: t("title"),
      description: t("description"),
      url: canonicalUrl,
      siteName: "prologue.run",
      type: "website",
      locale: locale === "zh-hk" ? "zh_HK" : "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;

  // Enable static rendering
  setRequestLocale(locale);

  // Fetch races from database
  let races: RaceCardData[];
  try {
    races = await getAllRaces();
  } catch (error) {
    console.error("HOMEPAGE FETCH ERROR:", error);
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
        <FAQSection />
        <ContactSection />
      </main>
      <Footer />
    </>
  );
}

import type { MetadataRoute } from "next";
import { getAllRaces } from "@/lib/db";
import { locales, defaultLocale } from "@/i18n/config";

const baseUrl = "https://prologue.run";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages = ["", "/privacy", "/terms"];

  // Generate URLs for all locales and static pages
  const staticUrls = staticPages.flatMap((page) =>
    locales.map((locale) => ({
      url: locale === defaultLocale ? `${baseUrl}${page}` : `${baseUrl}/${locale}${page}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: page === "" ? 1.0 : 0.5,
      alternates: {
        languages: Object.fromEntries(
          locales.map((l) => [
            l === "zh-hk" ? "zh-Hant-HK" : l,
            l === defaultLocale ? `${baseUrl}${page}` : `${baseUrl}/${l}${page}`,
          ])
        ),
      },
    }))
  );

  // Remove duplicate root URLs (keep only one per page, with alternates)
  const uniqueStaticUrls = staticPages.map((page) => ({
    url: `${baseUrl}${page}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: page === "" ? 1.0 : 0.5,
    alternates: {
      languages: Object.fromEntries(
        locales.map((l) => [
          l === "zh-hk" ? "zh-Hant-HK" : l,
          l === defaultLocale ? `${baseUrl}${page}` : `${baseUrl}/${l}${page}`,
        ])
      ),
    },
  }));

  // Fetch all races for dynamic URLs
  let races: { slug: string; updatedAt: string }[] = [];
  try {
    const allRaces = await getAllRaces();
    races = allRaces.map((race) => ({
      slug: race.slug,
      updatedAt: new Date().toISOString(),
    }));
  } catch {
    // If database is unavailable, just return static URLs
  }

  // Generate race page URLs for each locale
  const raceUrls = races.map((race) => ({
    url: `${baseUrl}/race/${race.slug}`,
    lastModified: new Date(race.updatedAt),
    changeFrequency: "weekly" as const,
    priority: 0.8,
    alternates: {
      languages: Object.fromEntries(
        locales.map((l) => [
          l === "zh-hk" ? "zh-Hant-HK" : l,
          l === defaultLocale
            ? `${baseUrl}/race/${race.slug}`
            : `${baseUrl}/${l}/race/${race.slug}`,
        ])
      ),
    },
  }));

  return [...uniqueStaticUrls, ...raceUrls];
}

import { notFound } from "next/navigation";
import { Suspense } from "react";
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import {
  getRaceBySlug,
  getImageMetadataByRaceId,
  getWaypointsByRaceId,
  getElevationPointsByRaceId,
  getRaceTranslation,
} from "@/lib/db";
import { parseViewState } from "@/lib/viewState";
import { RaceViewer } from "@/components/viewer/RaceViewer";
import {
  ENABLE_TESTING_CARDS,
  ENABLE_CACHING,
  CACHE_REVALIDATE_SECONDS,
  TEST_CARD_DATA,
  TEST_VIEWER_IMAGE_URL,
  DEFAULT_VIEW,
} from "@/lib/constants";
import { defaultLocale, locales } from "@/i18n/config";
import type { Race } from "@/types";

// When caching is enabled, use ISR with revalidation
// When disabled (during development/uploads), force dynamic rendering
export const dynamic = ENABLE_CACHING ? "auto" : "force-dynamic";
export const revalidate = ENABLE_CACHING ? CACHE_REVALIDATE_SECONDS : 0;

// Mock data for test route
const TEST_RACE: Race = {
  ...TEST_CARD_DATA,
  description: "A test route for development purposes.",
  raceDate: null,
  captureDate: "2024-01-01",
  captureDevice: "Test Device",
  status: "ready",
  isTesting: true,
  storageBucket: "test",
  storagePrefix: "test",
  totalViews: 0,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const TEST_IMAGES = [
  {
    id: "test-image-1",
    raceId: "card-preview",
    positionIndex: 0,
    latitude: 0,
    longitude: 0,
    altitudeMeters: 0,
    distanceFromStart: 0,
    elevationGainFromStart: 0,
    capturedAt: "2024-01-01T00:00:00Z",
    headingDegrees: null,
    headingToPrev: null,
    headingToNext: null,
    pathThumbnail: "",
    pathMedium: "",
    pathFull: "",
    fileSizeThumb: null,
    fileSizeMedium: null,
    fileSizeFull: null,
    hasBlurApplied: false,
    blurRegionsCount: 0,
    createdAt: "2024-01-01T00:00:00Z",
  },
];

interface PageProps {
  params: Promise<{
    locale: string;
    slug: string;
    viewState?: string[];
  }>;
}

function ViewerSkeleton() {
  return (
    <div className="fixed inset-0 bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-2 border-coral border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400">Loading viewer...</p>
      </div>
    </div>
  );
}

export default async function RaceViewerPage({ params }: PageProps) {
  const { locale, slug, viewState: viewStateSegments } = await params;

  // Enable static rendering
  setRequestLocale(locale);

  // Handle test route
  if (slug === "card-preview" && ENABLE_TESTING_CARDS) {
    const viewStateStr = viewStateSegments?.[0] || "@0";
    const parsedViewState = parseViewState(viewStateStr);

    return (
      <Suspense fallback={<ViewerSkeleton />}>
        <RaceViewer
          race={TEST_RACE}
          images={TEST_IMAGES}
          waypoints={[]}
          elevationProfile={null}
          initialPosition={parsedViewState?.position ?? 0}
          initialHeading={parsedViewState?.heading ?? DEFAULT_VIEW.heading}
          initialPitch={parsedViewState?.pitch ?? DEFAULT_VIEW.pitch}
          initialFov={parsedViewState?.fov ?? DEFAULT_VIEW.fov}
          testImageUrl={TEST_VIEWER_IMAGE_URL}
        />
      </Suspense>
    );
  }

  // Fetch race data
  let race;
  try {
    race = await getRaceBySlug(slug);
  } catch {
    race = null;
  }

  if (!race) {
    notFound();
  }

  // Get translation for the race if available
  const translation = await getRaceTranslation(race.id, locale);
  const translatedRace = translation
    ? {
        ...race,
        name: translation.name || race.name,
        description: translation.description || race.description,
        city: translation.city || race.city,
        country: translation.country || race.country,
      }
    : race;

  // Parse view state from URL
  const viewStateStr = viewStateSegments?.[0] || "@0";
  const parsedViewState = parseViewState(viewStateStr);

  // Fetch related data in parallel with error handling
  let images, waypoints, elevationPoints;
  try {
    [images, waypoints, elevationPoints] = await Promise.all([
      getImageMetadataByRaceId(race.id),
      getWaypointsByRaceId(race.id),
      getElevationPointsByRaceId(race.id),
    ]);
  } catch (error) {
    console.error("Error fetching race data:", error);
    notFound();
  }

  // Clamp initial position to valid range to prevent out-of-bounds access
  const maxPosition = Math.max(0, images.length - 1);
  const clampedPosition = Math.min(parsedViewState?.position ?? 0, maxPosition);

  // Build elevation profile
  const elevationProfile =
    elevationPoints.length > 0
      ? {
          points: elevationPoints.map((p) => ({
            distance: p.distanceMeters,
            elevation: p.elevationMeters,
          })),
          totalDistance: race.distanceMeters,
          minElevation: Math.min(...elevationPoints.map((p) => p.elevationMeters)),
          maxElevation: Math.max(...elevationPoints.map((p) => p.elevationMeters)),
        }
      : null;

  return (
    <Suspense fallback={<ViewerSkeleton />}>
      <RaceViewer
        race={translatedRace}
        images={images}
        waypoints={waypoints.map((w) => ({
          name: w.name,
          distanceMeters: w.distanceMeters,
          endDistanceMeters: w.endDistanceMeters,
        }))}
        elevationProfile={elevationProfile}
        initialPosition={clampedPosition}
        initialHeading={parsedViewState?.heading ?? DEFAULT_VIEW.heading}
        initialPitch={parsedViewState?.pitch ?? DEFAULT_VIEW.pitch}
        initialFov={parsedViewState?.fov ?? DEFAULT_VIEW.fov}
      />
    </Suspense>
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "racePage" });

  const baseUrl = "https://prologue.run";
  const path = `/race/${slug}`;

  // Handle test route metadata
  if (slug === "card-preview" && ENABLE_TESTING_CARDS) {
    return {
      title: `${TEST_RACE.name} - prologue.run`,
      description: t("metaDescription", { raceName: TEST_RACE.name }),
      openGraph: {
        title: `${TEST_RACE.name} - prologue.run`,
        description: t("metaDescription", { raceName: TEST_RACE.name }),
        images: TEST_RACE.cardImageUrl
          ? [{ url: TEST_RACE.cardImageUrl }]
          : undefined,
      },
    };
  }

  let race;
  try {
    race = await getRaceBySlug(slug);
  } catch {
    race = null;
  }

  if (!race) {
    return {
      title: t("notFoundTitle"),
    };
  }

  // Get translated race name if available
  const translation = await getRaceTranslation(race.id, locale);
  const raceName = translation?.name || race.name;

  const canonicalUrl =
    locale === defaultLocale ? `${baseUrl}${path}` : `${baseUrl}/${locale}${path}`;

  return {
    title: `${raceName} - prologue.run`,
    description: t("metaDescription", { raceName }),
    alternates: {
      canonical: canonicalUrl,
      languages: Object.fromEntries(
        locales.map((l) => [
          l === "zh-hk" ? "zh-Hant-HK" : l,
          l === defaultLocale ? `${baseUrl}${path}` : `${baseUrl}/${l}${path}`,
        ])
      ),
    },
    openGraph: {
      title: `${raceName} - prologue.run`,
      description: t("metaDescription", { raceName }),
      images: race.cardImageUrl ? [{ url: race.cardImageUrl }] : undefined,
      locale: locale === "zh-hk" ? "zh_HK" : "en_US",
    },
  };
}

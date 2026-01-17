import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getRaceBySlug, getImageMetadataByRaceId, getWaypointsByRaceId, getElevationPointsByRaceId } from "@/lib/db";
import { parseViewState } from "@/lib/viewState";
import { RaceViewer } from "@/components/viewer/RaceViewer";
import { Skeleton } from "@/components/ui/skeleton";
import { ENABLE_TESTING_CARDS, TEST_CARD_DATA, TEST_VIEWER_IMAGE_URL, DEFAULT_VIEW } from "@/lib/constants";
import type { Race } from "@/types";

export const dynamic = "force-dynamic";

// Mock data for test route
const TEST_RACE: Race = {
  ...TEST_CARD_DATA,
  description: "A test route for development purposes.",
  raceDate: null,
  captureDate: "2024-01-01",
  captureDevice: "Test Device",
  status: "ready",
  storageBucket: "test",
  storagePrefix: "test",
  totalViews: 0,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const TEST_IMAGES = [{
  id: "test-image-1",
  positionIndex: 0,
  latitude: 0,
  longitude: 0,
  altitudeMeters: 0,
  distanceFromStart: 0,
  capturedAt: "2024-01-01T00:00:00Z",
  headingDegrees: null,
  headingToPrev: null,
  headingToNext: null,
}];

interface PageProps {
  params: Promise<{
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
  const { slug, viewState: viewStateSegments } = await params;

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
    // Database not available
    race = null;
  }

  if (!race) {
    notFound();
  }

  // Parse view state from URL
  const viewStateStr = viewStateSegments?.[0] || "@0";
  const parsedViewState = parseViewState(viewStateStr);

  // Fetch related data in parallel
  const [images, waypoints, elevationPoints] = await Promise.all([
    getImageMetadataByRaceId(race.id),
    getWaypointsByRaceId(race.id),
    getElevationPointsByRaceId(race.id),
  ]);

  // Build elevation profile
  const elevationProfile = elevationPoints.length > 0
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
        race={race}
        images={images}
        waypoints={waypoints.map((w) => ({
          name: w.name,
          distanceMeters: w.distanceMeters,
          endDistanceMeters: w.endDistanceMeters,
        }))}
        elevationProfile={elevationProfile}
        initialPosition={parsedViewState?.position ?? 0}
        initialHeading={parsedViewState?.heading ?? DEFAULT_VIEW.heading}
        initialPitch={parsedViewState?.pitch ?? DEFAULT_VIEW.pitch}
        initialFov={parsedViewState?.fov ?? DEFAULT_VIEW.fov}
      />
    </Suspense>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;

  // Handle test route metadata
  if (slug === "card-preview" && ENABLE_TESTING_CARDS) {
    return {
      title: `${TEST_RACE.name} - prologue.run`,
      description: `Preview the ${TEST_RACE.name} route through interactive 360° street-level imagery.`,
      openGraph: {
        title: `${TEST_RACE.name} - prologue.run`,
        description: `Preview the ${TEST_RACE.name} route through interactive 360° street-level imagery.`,
        images: TEST_RACE.cardImageUrl ? [{ url: TEST_RACE.cardImageUrl }] : undefined,
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
      title: "Race Not Found - prologue.run",
    };
  }

  return {
    title: `${race.name} - prologue.run`,
    description: `Preview the ${race.name} route through interactive 360° street-level imagery.`,
    openGraph: {
      title: `${race.name} - prologue.run`,
      description: `Preview the ${race.name} route through interactive 360° street-level imagery.`,
      images: race.cardImageUrl ? [{ url: race.cardImageUrl }] : undefined,
    },
  };
}

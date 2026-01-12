import { NextResponse } from "next/server";
import { getRaceBySlug, getElevationPointsByRaceId } from "@/lib/db";
import { getDistanceLabels } from "@/lib/constants";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/races/[slug]/elevation-profile
 * Returns sampled elevation data for viewer HUD.
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params;

    const race = await getRaceBySlug(slug);

    if (!race) {
      return NextResponse.json(
        { error: "Race not found" },
        { status: 404 }
      );
    }

    const elevationPoints = await getElevationPointsByRaceId(race.id);

    if (elevationPoints.length === 0) {
      // Return empty profile if no elevation data
      return NextResponse.json({
        totalDistance: race.distanceMeters,
        minElevation: 0,
        maxElevation: 0,
        points: [],
        gridLabels: getDistanceLabels(race.distanceMeters),
      });
    }

    const elevations = elevationPoints.map((p) => p.elevationMeters);
    const minElevation = Math.min(...elevations);
    const maxElevation = Math.max(...elevations);

    return NextResponse.json({
      totalDistance: race.distanceMeters,
      minElevation,
      maxElevation,
      points: elevationPoints.map((p) => ({
        distance: p.distanceMeters,
        elevation: p.elevationMeters,
      })),
      gridLabels: getDistanceLabels(race.distanceMeters),
    });
  } catch (error) {
    console.error("Error fetching elevation profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch elevation profile" },
      { status: 500 }
    );
  }
}

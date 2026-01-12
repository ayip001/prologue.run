import { NextResponse } from "next/server";
import {
  getRaceBySlug,
  getImageMetadataByRaceId,
  getWaypointsByRaceId,
} from "@/lib/db";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/races/[slug]
 * Returns race details with image metadata and waypoints.
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

    const [images, waypoints] = await Promise.all([
      getImageMetadataByRaceId(race.id),
      getWaypointsByRaceId(race.id),
    ]);

    return NextResponse.json({
      race,
      images,
      waypoints: waypoints.map((w) => ({
        name: w.name,
        distanceMeters: w.distanceMeters,
        endDistanceMeters: w.endDistanceMeters,
      })),
    });
  } catch (error) {
    console.error("Error fetching race:", error);
    return NextResponse.json(
      { error: "Failed to fetch race" },
      { status: 500 }
    );
  }
}

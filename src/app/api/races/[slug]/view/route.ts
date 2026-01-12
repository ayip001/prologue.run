import { NextResponse } from "next/server";
import { getRaceBySlug, incrementRaceViews } from "@/lib/db";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * POST /api/races/[slug]/view
 * Increment view count for a race.
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params;

    const race = await getRaceBySlug(slug);

    if (!race) {
      return NextResponse.json(
        { error: "Race not found" },
        { status: 404 }
      );
    }

    await incrementRaceViews(race.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error incrementing view count:", error);
    return NextResponse.json(
      { error: "Failed to increment view count" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getRaceBySlug, incrementRaceViews } from "@/lib/db";
import { ENABLE_VIEW_COUNTING } from "@/lib/constants";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * POST /api/races/[slug]/view
 * Increment view count for a race.
 *
 * NOTE: Currently disabled until rate limiting is implemented.
 * Enable by setting ENABLE_VIEW_COUNTING = true in constants.ts
 */
export async function POST(request: Request, { params }: RouteParams) {
  // Return early if view counting is disabled (security measure)
  if (!ENABLE_VIEW_COUNTING) {
    return NextResponse.json({ success: true, message: "View counting disabled" });
  }

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

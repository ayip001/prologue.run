import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getRaceBySlug, incrementRaceViews } from "@/lib/db";
import { shouldCountView } from "@/lib/ratelimit";
import { ENABLE_VIEW_COUNTING } from "@/lib/constants";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * POST /api/races/[slug]/view
 * Increment view count for a race.
 *
 * Rate limited to 1 view per IP per race per hour to prevent abuse.
 * Enable by setting ENABLE_VIEW_COUNTING = true in constants.ts
 */
export async function POST(request: Request, { params }: RouteParams) {
  // Return early if view counting is disabled
  if (!ENABLE_VIEW_COUNTING) {
    return NextResponse.json({ success: true, message: "View counting disabled" });
  }

  try {
    const { slug } = await params;

    // Get client IP for rate limiting
    const headersList = await headers();
    const forwardedFor = headersList.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() || "anonymous";

    // Check rate limit before doing any database work
    const { allowed, remaining } = await shouldCountView(ip, slug);

    if (!allowed) {
      return NextResponse.json(
        { success: false, message: "Rate limited", remaining },
        { status: 429 }
      );
    }

    // Only fetch race and increment if rate limit allows
    const race = await getRaceBySlug(slug);

    if (!race) {
      return NextResponse.json(
        { error: "Race not found" },
        { status: 404 }
      );
    }

    await incrementRaceViews(race.id);

    return NextResponse.json({ success: true, remaining });
  } catch (error) {
    console.error("Error incrementing view count:", error);
    return NextResponse.json(
      { error: "Failed to increment view count" },
      { status: 500 }
    );
  }
}

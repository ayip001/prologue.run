import { NextResponse } from "next/server";
import { getAllRaces } from "@/lib/db";
import { ENABLE_CACHING, CACHE_REVALIDATE_SECONDS } from "@/lib/constants";

// When caching is enabled, use ISR with revalidation
// When disabled (during development/uploads), force dynamic rendering
export const dynamic = ENABLE_CACHING ? "auto" : "force-dynamic";
export const revalidate = ENABLE_CACHING ? CACHE_REVALIDATE_SECONDS : 0;

/**
 * GET /api/races
 * Returns all races that are ready for display.
 */
export async function GET() {
  try {
    const races = await getAllRaces();

    return NextResponse.json({ races });
  } catch (error) {
    console.error("Error fetching races:", error);
    return NextResponse.json(
      { error: "Failed to fetch races" },
      { status: 500 }
    );
  }
}

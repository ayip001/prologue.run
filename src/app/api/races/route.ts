import { NextResponse } from "next/server";
import { getAllRaces } from "@/lib/db";

export const dynamic = "force-dynamic";

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

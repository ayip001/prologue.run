import { sql } from "@vercel/postgres";
import { unstable_noStore as noStore } from 'next/cache';
import type {
  Race,
  RaceCardData,
  ImageMeta,
  Waypoint,
  ElevationPoint,
} from "@/types";

// ============================================================================
// Database Row Types (snake_case from PostgreSQL)
// ============================================================================

interface RaceRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  flag_emoji: string | null;
  recorded_year: number | null;
  recorded_by: string | null;
  distance_meters: number;
  race_date: string | null;
  city: string | null;
  country: string | null;
  elevation_gain: number | null;
  elevation_loss: number | null;
  elevation_bars: number[] | null;
  route_svg_path: string | null;
  card_image_url: string | null;
  tier: "gold" | "silver" | "bronze" | null;
  total_images: number;
  capture_date: string;
  capture_device: string | null;
  status: "pending" | "processing" | "ready" | "error";
  storage_bucket: string;
  storage_prefix: string;
  total_views: number;
  created_at: string;
  updated_at: string;
}

interface ImageRow {
  id: string;
  race_id: string;
  position_index: number;
  latitude: string | null;
  longitude: string | null;
  altitude_meters: string | null;
  captured_at: string;
  heading_degrees: string | null;
  heading_to_prev: string | null;
  heading_to_next: string | null;
  distance_from_start: number | null;
  path_thumbnail: string;
  path_medium: string;
  path_full: string;
  file_size_thumb: number | null;
  file_size_medium: number | null;
  file_size_full: number | null;
  has_blur_applied: boolean;
  blur_regions_count: number;
  created_at: string;
}

interface WaypointRow {
  id: string;
  race_id: string;
  name: string;
  distance_meters: number;
  end_distance_meters: number | null;
  description: string | null;
}

interface ElevationPointRow {
  distance_meters: number;
  elevation_meters: string;
  gradient_percent: string | null;
}

// ============================================================================
// Transform Functions
// ============================================================================

function transformRace(row: RaceRow): Race {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    flagEmoji: row.flag_emoji,
    recordedYear: row.recorded_year,
    recordedBy: row.recorded_by,
    distanceMeters: row.distance_meters,
    raceDate: row.race_date,
    city: row.city,
    country: row.country,
    elevationGain: row.elevation_gain,
    elevationLoss: row.elevation_loss,
    elevationBars: row.elevation_bars,
    routeSvgPath: row.route_svg_path,
    cardImageUrl: row.card_image_url,
    tier: row.tier,
    totalImages: row.total_images,
    captureDate: row.capture_date,
    captureDevice: row.capture_device,
    status: row.status,
    storageBucket: row.storage_bucket,
    storagePrefix: row.storage_prefix,
    totalViews: row.total_views,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function transformRaceCard(row: RaceRow): RaceCardData {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    flagEmoji: row.flag_emoji,
    recordedYear: row.recorded_year,
    recordedBy: row.recorded_by,
    distanceMeters: row.distance_meters,
    elevationGain: row.elevation_gain,
    elevationLoss: row.elevation_loss,
    city: row.city,
    country: row.country,
    tier: row.tier,
    cardImageUrl: row.card_image_url,
    routeSvgPath: row.route_svg_path,
    elevationBars: row.elevation_bars,
    totalImages: row.total_images,
    officialUrl: (row as any).official_url || null,
  };
}

function transformImage(row: ImageRow): ImageMeta {
  return {
    id: row.id,
    raceId: row.race_id,
    positionIndex: row.position_index,
    latitude: row.latitude ? parseFloat(row.latitude) : null,
    longitude: row.longitude ? parseFloat(row.longitude) : null,
    altitudeMeters: row.altitude_meters ? parseFloat(row.altitude_meters) : null,
    capturedAt: row.captured_at,
    headingDegrees: row.heading_degrees ? parseFloat(row.heading_degrees) : null,
    headingToPrev: row.heading_to_prev ? parseFloat(row.heading_to_prev) : null,
    headingToNext: row.heading_to_next ? parseFloat(row.heading_to_next) : null,
    distanceFromStart: row.distance_from_start,
    pathThumbnail: row.path_thumbnail,
    pathMedium: row.path_medium,
    pathFull: row.path_full,
    fileSizeThumb: row.file_size_thumb,
    fileSizeMedium: row.file_size_medium,
    fileSizeFull: row.file_size_full,
    hasBlurApplied: row.has_blur_applied,
    blurRegionsCount: row.blur_regions_count,
    createdAt: row.created_at,
  };
}

function transformWaypoint(row: WaypointRow): Waypoint {
  return {
    id: row.id,
    raceId: row.race_id,
    name: row.name,
    distanceMeters: row.distance_meters,
    endDistanceMeters: row.end_distance_meters,
    description: row.description,
  };
}

function transformElevationPoint(row: ElevationPointRow): ElevationPoint {
  return {
    distanceMeters: row.distance_meters,
    elevationMeters: parseFloat(row.elevation_meters),
    gradientPercent: row.gradient_percent ? parseFloat(row.gradient_percent) : null,
  };
}

// ============================================================================
// Database Queries
// ============================================================================

/**
 * Get all races that are ready for display.
 */
export async function getAllRaces(): Promise<RaceCardData[]> {
  noStore();
  const result = await sql<RaceRow>`
    SELECT
      id, slug, name, flag_emoji, recorded_year, recorded_by,
      distance_meters, elevation_gain, elevation_loss, city, country,
      tier, card_image_url, route_svg_path, elevation_bars, total_images
    FROM races
    WHERE status = 'ready'
    ORDER BY created_at DESC
  `;

  return result.rows.map(transformRaceCard);
}

/**
 * Get a single race by slug.
 */
export async function getRaceBySlug(slug: string): Promise<Race | null> {
  noStore();
  const result = await sql<RaceRow>`
    SELECT *
    FROM races
    WHERE slug = ${slug} AND status = 'ready'
    LIMIT 1
  `;

  if (result.rows.length === 0) return null;
  return transformRace(result.rows[0]);
}

/**
 * Get all images for a race.
 */
export async function getImagesByRaceId(raceId: string): Promise<ImageMeta[]> {
  const result = await sql<ImageRow>`
    SELECT *
    FROM images
    WHERE race_id = ${raceId}
    ORDER BY position_index
  `;

  return result.rows.map(transformImage);
}

/**
 * Get image metadata for a race (lightweight version for viewer).
 */
export async function getImageMetadataByRaceId(
  raceId: string
): Promise<Pick<ImageMeta, "id" | "positionIndex" | "latitude" | "longitude" | "distanceFromStart" | "capturedAt" | "headingDegrees" | "headingToPrev" | "headingToNext">[]> {
  const result = await sql<ImageRow>`
    SELECT id, position_index, latitude, longitude, distance_from_start, captured_at, heading_degrees, heading_to_prev, heading_to_next
    FROM images
    WHERE race_id = ${raceId}
    ORDER BY position_index
  `;

  return result.rows.map((row) => ({
    id: row.id,
    positionIndex: row.position_index,
    latitude: row.latitude ? parseFloat(row.latitude) : null,
    longitude: row.longitude ? parseFloat(row.longitude) : null,
    distanceFromStart: row.distance_from_start,
    capturedAt: row.captured_at,
    headingDegrees: row.heading_degrees ? parseFloat(row.heading_degrees) : null,
    headingToPrev: row.heading_to_prev ? parseFloat(row.heading_to_prev) : null,
    headingToNext: row.heading_to_next ? parseFloat(row.heading_to_next) : null,
  }));
}

/**
 * Get waypoints for a race.
 */
export async function getWaypointsByRaceId(raceId: string): Promise<Waypoint[]> {
  const result = await sql<WaypointRow>`
    SELECT *
    FROM waypoints
    WHERE race_id = ${raceId}
    ORDER BY distance_meters
  `;

  return result.rows.map(transformWaypoint);
}

/**
 * Get elevation points for a race.
 */
export async function getElevationPointsByRaceId(raceId: string): Promise<ElevationPoint[]> {
  const result = await sql<ElevationPointRow>`
    SELECT distance_meters, elevation_meters, gradient_percent
    FROM elevation_points
    WHERE race_id = ${raceId}
    ORDER BY distance_meters
  `;

  return result.rows.map(transformElevationPoint);
}

/**
 * Increment view count for a race.
 */
export async function incrementRaceViews(raceId: string): Promise<void> {
  await sql`
    UPDATE races
    SET total_views = total_views + 1
    WHERE id = ${raceId}
  `;
}

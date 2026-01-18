import { sql } from "@vercel/postgres";
import { unstable_noStore as noStore } from 'next/cache';
import { ENABLE_TESTING_CARDS, ENABLE_CACHING } from './constants';
import {
  POI_TYPES,
} from "@/types";
import type {
  Race,
  RaceCardData,
  ImageMeta,
  Waypoint,
  ElevationPoint,
  PoiMarker,
  PoiType,
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
  poi_markers: unknown;
  minimap_url: string | null;
  card_image_url: string | null;
  official_url: string | null;
  tier: "gold" | "silver" | "bronze" | null;
  total_images: number;
  capture_date: string;
  capture_device: string | null;
  status: "pending" | "processing" | "ready" | "error";
  is_testing: boolean;
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
  heading_offset_degrees: string | null;
  distance_from_start: number | null;
  elevation_gain_from_start: number | null;
  pois: unknown;
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

interface RaceTranslationRow {
  id: string;
  race_id: string;
  locale: string;
  name: string | null;
  description: string | null;
  city: string | null;
  country: string | null;
}

export interface RaceTranslation {
  id: string;
  raceId: string;
  locale: string;
  name: string | null;
  description: string | null;
  city: string | null;
  country: string | null;
}

// ============================================================================
// Transform Functions
// ============================================================================

const POI_TYPE_SET = new Set<PoiType>(POI_TYPES);

function isPoiType(value: string): value is PoiType {
  return POI_TYPE_SET.has(value as PoiType);
}

function normalizePois(value: unknown): ImageMeta["pois"] {
  if (!Array.isArray(value)) return null;
  const normalized = value
    .map((poi) => {
      if (!poi || typeof poi !== "object") return null;
      const typed = poi as {
        type?: string;
        heading?: number;
        pitch?: number;
        visibleOnImage?: boolean;
      };
      if (!typed.type || !isPoiType(typed.type)) return null;
      return {
        type: typed.type,
        heading: typeof typed.heading === "number" ? typed.heading : 0,
        pitch: typeof typed.pitch === "number" ? typed.pitch : 0,
        visibleOnImage: typed.visibleOnImage ?? true,
      };
    })
    .filter(Boolean) as ImageMeta["pois"];

  return normalized.length > 0 ? normalized : [];
}

function normalizePoiMarkers(value: unknown): PoiMarker[] | null {
  if (!Array.isArray(value)) return null;
  const normalized = value
    .map((marker) => {
      if (!marker || typeof marker !== "object") return null;
      const typed = marker as {
        imageIndex?: number;
        distanceFromStart?: number;
        pois?: string[];
      };
      if (typeof typed.imageIndex !== "number") return null;
      const pois = Array.isArray(typed.pois)
        ? typed.pois.filter((poi): poi is PoiType => isPoiType(poi))
        : [];
      return {
        imageIndex: typed.imageIndex,
        distanceFromStart:
          typeof typed.distanceFromStart === "number" ? typed.distanceFromStart : 0,
        pois,
      };
    })
    .filter(Boolean) as PoiMarker[];

  return normalized.length > 0 ? normalized : [];
}

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
    poiMarkers: normalizePoiMarkers(row.poi_markers),
    minimapUrl: row.minimap_url,
    cardImageUrl: row.card_image_url,
    officialUrl: row.official_url,
    tier: row.tier,
    totalImages: row.total_images,
    captureDate: row.capture_date,
    captureDevice: row.capture_device,
    status: row.status,
    isTesting: Boolean(row.is_testing),
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
    minimapUrl: row.minimap_url,
    elevationBars: row.elevation_bars,
    totalImages: row.total_images,
    isTesting: Boolean(row.is_testing),
    officialUrl: row.official_url,
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
    headingOffsetDegrees: row.heading_offset_degrees ? parseFloat(row.heading_offset_degrees) : null,
    distanceFromStart: row.distance_from_start,
    elevationGainFromStart: row.elevation_gain_from_start,
    pois: normalizePois(row.pois),
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
export async function getAllRaces(locale: string = "en"): Promise<RaceCardData[]> {
  // Only bypass cache during development/race uploads
  if (!ENABLE_CACHING) {
    noStore();
  }
  
  try {
    // Attempt to fetch with translations
    const result = ENABLE_TESTING_CARDS
      ? await sql<RaceRow>`
          SELECT 
            r.id, r.slug, 
            COALESCE(t.name, r.name) as name, 
            r.flag_emoji, r.recorded_year, r.recorded_by,
            r.distance_meters, r.elevation_gain, r.elevation_loss, 
            COALESCE(t.city, r.city) as city, 
            COALESCE(t.country, r.country) as country,
            r.tier, r.card_image_url, r.minimap_url, r.official_url, r.elevation_bars, r.total_images, 
            COALESCE(r.is_testing, FALSE) as is_testing
          FROM races r
          LEFT JOIN race_translations t ON r.id = t.race_id AND t.locale = ${locale}
          WHERE r.status = 'ready'
          ORDER BY r.created_at DESC
        `
      : await sql<RaceRow>`
          SELECT 
            r.id, r.slug, 
            COALESCE(t.name, r.name) as name, 
            r.flag_emoji, r.recorded_year, r.recorded_by,
            r.distance_meters, r.elevation_gain, r.elevation_loss, 
            COALESCE(t.city, r.city) as city, 
            COALESCE(t.country, r.country) as country,
            r.tier, r.card_image_url, r.minimap_url, r.official_url, r.elevation_bars, r.total_images, 
            COALESCE(r.is_testing, FALSE) as is_testing
          FROM races r
          LEFT JOIN race_translations t ON r.id = t.race_id AND t.locale = ${locale}
          WHERE r.status = 'ready' AND COALESCE(r.is_testing, FALSE) = FALSE
          ORDER BY r.created_at DESC
        `;

    return result.rows.map(transformRaceCard);
  } catch (error) {
    console.error("Error fetching races with translations, falling back to base data:", error);
    
    // Fallback to base data if translations table fails
    const result = ENABLE_TESTING_CARDS
      ? await sql<RaceRow>`
          SELECT *, COALESCE(is_testing, FALSE) as is_testing
          FROM races
          WHERE status = 'ready'
          ORDER BY created_at DESC
        `
      : await sql<RaceRow>`
          SELECT *, COALESCE(is_testing, FALSE) as is_testing
          FROM races
          WHERE status = 'ready' AND COALESCE(is_testing, FALSE) = FALSE
          ORDER BY created_at DESC
        `;
    return result.rows.map(transformRaceCard);
  }
}

/**
 * Get a single race by slug.
 */
export async function getRaceBySlug(slug: string, locale: string = "en"): Promise<Race | null> {
  // Only bypass cache during development/race uploads
  if (!ENABLE_CACHING) {
    noStore();
  }
  
  try {
    const result = await sql<RaceRow>`
      SELECT 
        r.id, r.slug, r.flag_emoji, r.recorded_year, r.recorded_by,
        r.distance_meters, r.race_date, r.elevation_gain, r.elevation_loss,
        r.elevation_bars, r.poi_markers, r.minimap_url, r.card_image_url, r.tier,
        r.total_images, r.capture_date, r.capture_device, r.status,
        r.is_testing, r.storage_bucket, r.storage_prefix, r.total_views,
        r.created_at, r.updated_at,
        COALESCE(t.name, r.name) as name,
        COALESCE(t.description, r.description) as description,
        COALESCE(t.city, r.city) as city,
        COALESCE(t.country, r.country) as country
      FROM races r
      LEFT JOIN race_translations t ON r.id = t.race_id AND t.locale = ${locale}
      WHERE r.slug = ${slug} AND r.status = 'ready'
      LIMIT 1
    `;

    if (result.rows.length === 0) return null;
    
    const race = transformRace(result.rows[0]);
    
    // If it's a testing race and testing is disabled, hide it
    if (race.isTesting && !ENABLE_TESTING_CARDS) {
      return null;
    }
    
    return race;
  } catch (error) {
    console.error("Error fetching race with translations, falling back to base data:", error);
    
    const result = await sql<RaceRow>`
      SELECT *, COALESCE(is_testing, FALSE) as is_testing
      FROM races
      WHERE slug = ${slug} AND status = 'ready'
      LIMIT 1
    `;

    if (result.rows.length === 0) return null;
    
    const race = transformRace(result.rows[0]);
    
    if (race.isTesting && !ENABLE_TESTING_CARDS) {
      return null;
    }
    
    return race;
  }
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
): Promise<Pick<ImageMeta, "id" | "positionIndex" | "latitude" | "longitude" | "altitudeMeters" | "distanceFromStart" | "elevationGainFromStart" | "capturedAt" | "headingDegrees" | "headingToPrev" | "headingToNext" | "headingOffsetDegrees" | "pois">[]> {
  const result = await sql<ImageRow>`
    SELECT id, position_index, latitude, longitude, altitude_meters, distance_from_start, elevation_gain_from_start, captured_at, heading_degrees, heading_to_prev, heading_to_next, heading_offset_degrees, pois
    FROM images
    WHERE race_id = ${raceId}
    ORDER BY position_index
  `;

  return result.rows.map((row) => ({
    id: row.id,
    positionIndex: row.position_index,
    latitude: row.latitude ? parseFloat(row.latitude) : null,
    longitude: row.longitude ? parseFloat(row.longitude) : null,
    altitudeMeters: row.altitude_meters ? parseFloat(row.altitude_meters) : null,
    distanceFromStart: row.distance_from_start,
    elevationGainFromStart: row.elevation_gain_from_start,
    capturedAt: row.captured_at,
    headingDegrees: row.heading_degrees ? parseFloat(row.heading_degrees) : null,
    headingToPrev: row.heading_to_prev ? parseFloat(row.heading_to_prev) : null,
    headingToNext: row.heading_to_next ? parseFloat(row.heading_to_next) : null,
    headingOffsetDegrees: row.heading_offset_degrees ? parseFloat(row.heading_offset_degrees) : null,
    pois: normalizePois(row.pois),
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

// ============================================================================
// Race Translations
// ============================================================================

/**
 * Get translation for a race in a specific locale.
 * Returns null if no translation exists for the locale or if the table doesn't exist yet.
 */
export async function getRaceTranslation(
  raceId: string,
  locale: string
): Promise<RaceTranslation | null> {
  // Skip for default locale (English) - use base race data
  if (locale === "en") {
    return null;
  }

  try {
    const result = await sql<RaceTranslationRow>`
      SELECT id, race_id, locale, name, description, city, country
      FROM race_translations
      WHERE race_id = ${raceId} AND locale = ${locale}
      LIMIT 1
    `;

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      raceId: row.race_id,
      locale: row.locale,
      name: row.name,
      description: row.description,
      city: row.city,
      country: row.country,
    };
  } catch {
    // Table might not exist yet - return null gracefully
    return null;
  }
}

/**
 * Get all translations for a race.
 */
export async function getRaceTranslations(
  raceId: string
): Promise<RaceTranslation[]> {
  try {
    const result = await sql<RaceTranslationRow>`
      SELECT id, race_id, locale, name, description, city, country
      FROM race_translations
      WHERE race_id = ${raceId}
    `;

    return result.rows.map((row) => ({
      id: row.id,
      raceId: row.race_id,
      locale: row.locale,
      name: row.name,
      description: row.description,
      city: row.city,
      country: row.country,
    }));
  } catch {
    // Table might not exist yet - return empty array
    return [];
  }
}

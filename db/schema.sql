-- 360° Race Route Viewer Database Schema
-- PostgreSQL with PostGIS extension for spatial queries

-- Enable PostGIS for spatial queries (future minimap feature)
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================================
-- CORE TABLES
-- ============================================================================

CREATE TABLE races (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            VARCHAR(100) UNIQUE NOT NULL,  -- URL-friendly identifier
    name            VARCHAR(255) NOT NULL,
    description     TEXT,

    -- Display metadata
    flag_emoji      VARCHAR(10),                   -- '🇭🇰', '🇯🇵', etc.
    recorded_year   INTEGER,
    recorded_by     VARCHAR(100),                  -- 'Angus Yip'

    -- Race metadata
    distance_meters INTEGER NOT NULL,              -- 42195 for marathon
    race_date       DATE,
    city            VARCHAR(100),
    country         VARCHAR(100),

    -- Elevation summary
    elevation_gain  INTEGER,                       -- meters
    elevation_loss  INTEGER,                       -- meters

    -- Card display data (JSON for flexibility)
    elevation_bars  JSONB,                         -- [0-100] array, ~30-40 values
    route_svg_path  VARCHAR(255),                  -- 'races/hk-marathon/route-overlay.svg'
    card_image_url  VARCHAR(500),                  -- Hero image for card

    -- Quality tier badge
    tier            VARCHAR(20),                   -- 'gold', 'silver', 'bronze', null

    -- Image collection info
    total_images    INTEGER NOT NULL DEFAULT 0,
    capture_date    DATE NOT NULL,
    capture_device  VARCHAR(100),                  -- 'Insta360 X4'

    -- Processing status
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
                    -- pending, processing, ready, error

    -- Storage references
    storage_bucket  VARCHAR(100) NOT NULL,         -- R2 bucket name
    storage_prefix  VARCHAR(255) NOT NULL,         -- 'races/tokyo-marathon-2024/'

    -- Stats
    total_views     INTEGER DEFAULT 0,

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_races_slug ON races(slug);
CREATE INDEX idx_races_status ON races(status);


CREATE TABLE images (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    race_id         UUID NOT NULL REFERENCES races(id) ON DELETE CASCADE,

    -- Position in sequence (0-indexed)
    position_index  INTEGER NOT NULL,

    -- GPS data (nullable for indoor/tunnel sections)
    latitude        DECIMAL(10, 8),
    longitude       DECIMAL(11, 8),
    altitude_meters DECIMAL(7, 2),

    -- PostGIS point for spatial queries (future minimap)
    location        GEOGRAPHY(POINT, 4326),

    -- Capture metadata
    captured_at     TIMESTAMPTZ NOT NULL,

    -- Heading/orientation fields for Street View-like navigation
    heading_degrees DECIMAL(5, 2),                 -- Direction of travel (0-360, from GPX)
    heading_to_prev DECIMAL(5, 2),                 -- Bearing to previous image (for back arrow)
    heading_to_next DECIMAL(5, 2),                 -- Bearing to next image (for forward arrow)
    heading_offset_degrees DECIMAL(5, 2) DEFAULT 0, -- Manual adjustment if camera wasn't pointing forward

    -- Distance from start (meters) - for progress bar
    distance_from_start INTEGER,

    -- Storage paths (relative to race storage_prefix)
    path_thumbnail  VARCHAR(255) NOT NULL,         -- 'thumb/0001.avif'
    path_medium     VARCHAR(255) NOT NULL,         -- 'medium/0001.avif'
    path_full       VARCHAR(255) NOT NULL,         -- 'full/0001.avif'

    -- Fallback paths (WebP)
    path_thumb_webp VARCHAR(255) NOT NULL,
    path_med_webp   VARCHAR(255) NOT NULL,
    path_full_webp  VARCHAR(255) NOT NULL,

    -- Processing metadata
    file_size_thumb INTEGER,                       -- bytes
    file_size_medium INTEGER,
    file_size_full  INTEGER,

    -- Quality/processing flags
    has_blur_applied BOOLEAN DEFAULT FALSE,
    blur_regions_count INTEGER DEFAULT 0,

    created_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(race_id, position_index)
);

CREATE INDEX idx_images_race_position ON images(race_id, position_index);
CREATE INDEX idx_images_location ON images USING GIST(location);


-- ============================================================================
-- FUTURE-READY TABLES (create now, populate later)
-- ============================================================================

-- GPX track data for minimap overlay
CREATE TABLE gpx_tracks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    race_id         UUID NOT NULL REFERENCES races(id) ON DELETE CASCADE,

    name            VARCHAR(100),                  -- 'Official Route'
    track_type      VARCHAR(50) DEFAULT 'route',   -- route, elevation, segment

    -- Full GPX stored as JSON array of points
    -- [{lat, lon, ele, time}, ...]
    points          JSONB NOT NULL,

    -- Simplified polyline for map rendering (fewer points)
    simplified_points JSONB,

    -- Bounds for map viewport
    bounds_north    DECIMAL(10, 8),
    bounds_south    DECIMAL(10, 8),
    bounds_east     DECIMAL(11, 8),
    bounds_west     DECIMAL(11, 8),

    total_distance  INTEGER,                       -- meters
    elevation_gain  INTEGER,                       -- meters
    elevation_loss  INTEGER,                       -- meters

    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gpx_tracks_race ON gpx_tracks(race_id);


-- Elevation profile points (sampled for height diagram)
CREATE TABLE elevation_points (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    race_id         UUID NOT NULL REFERENCES races(id) ON DELETE CASCADE,

    distance_meters INTEGER NOT NULL,              -- Distance from start
    elevation_meters DECIMAL(7, 2) NOT NULL,
    gradient_percent DECIMAL(5, 2),                -- Grade at this point

    -- Optional: link to nearest image
    nearest_image_id UUID REFERENCES images(id),

    UNIQUE(race_id, distance_meters)
);

CREATE INDEX idx_elevation_race_dist ON elevation_points(race_id, distance_meters);


-- Waypoints for HUD display ("KM 32 - The Bridge")
CREATE TABLE waypoints (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    race_id         UUID NOT NULL REFERENCES races(id) ON DELETE CASCADE,

    name            VARCHAR(100) NOT NULL,         -- "The Bridge", "Harbour Tunnel"
    distance_meters INTEGER NOT NULL,              -- Start distance for this waypoint
    end_distance_meters INTEGER,                   -- Optional end (for segments)

    -- Optional metadata
    description     TEXT,

    created_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(race_id, distance_meters)
);

CREATE INDEX idx_waypoints_race_dist ON waypoints(race_id, distance_meters);


-- Race data overlay points (km markers, aid stations, etc.)
CREATE TABLE race_markers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    race_id         UUID NOT NULL REFERENCES races(id) ON DELETE CASCADE,

    marker_type     VARCHAR(50) NOT NULL,          -- km_marker, aid_station,
                                                   -- water_stop, toilet, medical

    label           VARCHAR(100),                  -- '5K', 'Aid Station 3'
    description     TEXT,

    distance_meters INTEGER NOT NULL,
    latitude        DECIMAL(10, 8),
    longitude       DECIMAL(11, 8),

    -- Link to nearest image for jumping to this point
    nearest_image_id UUID REFERENCES images(id),

    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_markers_race ON race_markers(race_id, marker_type);


-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Update location geography from lat/lon
CREATE OR REPLACE FUNCTION update_image_location()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_image_location
    BEFORE INSERT OR UPDATE ON images
    FOR EACH ROW
    EXECUTE FUNCTION update_image_location();


-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_races_updated
    BEFORE UPDATE ON races
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

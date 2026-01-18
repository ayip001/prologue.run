-- Race Translations Table
-- Stores localized content for races (name, description, city, country)

CREATE TABLE IF NOT EXISTS race_translations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    race_id         UUID NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    locale          VARCHAR(10) NOT NULL,        -- 'en', 'zh-hk', etc.

    -- Translatable fields
    name            VARCHAR(255),                -- Localized race name
    description     TEXT,                        -- Localized description
    city            VARCHAR(100),                -- Localized city name
    country         VARCHAR(100),                -- Localized country name

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(race_id, locale)
);

CREATE INDEX IF NOT EXISTS idx_race_translations_race_locale ON race_translations(race_id, locale);

-- Add trigger for updated_at
CREATE TRIGGER trigger_race_translations_updated
    BEFORE UPDATE ON race_translations
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- Example: Insert Chinese translations
-- INSERT INTO race_translations (race_id, locale, name, description, city, country)
-- VALUES
--   ('uuid-here', 'zh-hk', '香港馬拉松 2024', '香港年度馬拉松賽事...', '香港', '中國香港');

"""
Database utilities for race data management.

Provides connection handling and CRUD operations for the race database.
"""

import json
import os
from datetime import date, datetime
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import yaml
from rich.console import Console
from rich.table import Table

console = Console()


def get_connection_string() -> Optional[str]:
    """
    Get database connection string from environment.

    Looks for DATABASE_URL in environment, or loads from .env files.
    """
    from dotenv import load_dotenv

    # Try to load .env files from workspace root
    root_dir = Path(__file__).parent.parent.parent.parent.parent
    for env_file in [".env.local", ".env"]:
        env_path = root_dir / env_file
        if env_path.exists():
            load_dotenv(env_path)
            break

    return os.getenv("DATABASE_URL")


def get_connection():
    """
    Get a database connection.

    Returns:
        psycopg2 connection object
    """
    import psycopg2
    from urllib.parse import unquote

    conn_str = get_connection_string()
    if not conn_str:
        raise RuntimeError(
            "DATABASE_URL not set. Add it to .env.local or environment."
        )

    # For Neon/Postgres URIs, we sometimes need to handle query params manually
    # especially on Windows with psycopg2 URI parsing issues.
    if conn_str.startswith("postgres://") or conn_str.startswith("postgresql://"):
        url = urlparse(conn_str)
        params = {
            "database": url.path[1:],
            "user": url.username,
            "password": url.password,
            "host": url.hostname,
            "port": url.port or 5432,
        }
        
        # Handle query parameters (like sslmode)
        if url.query:
            from urllib.parse import parse_qs
            query_params = parse_qs(url.query)
            for k, v in query_params.items():
                params[k] = v[0]

        return psycopg2.connect(**params)

    return psycopg2.connect(conn_str)


def init_schema(schema_path: Optional[Path] = None) -> bool:
    """
    Initialize database schema from schema.sql.

    Args:
        schema_path: Path to schema.sql (default: db/schema.sql in repo root)

    Returns:
        True if successful
    """
    if schema_path is None:
        # Default to db/schema.sql in repo root
        root_dir = Path(__file__).parent.parent.parent.parent.parent
        schema_path = root_dir / "db" / "schema.sql"

    if not schema_path.exists():
        console.print(f"[red]Schema file not found:[/] {schema_path}")
        return False

    console.print(f"[bold]Initializing database schema[/]")
    console.print(f"  Schema: {schema_path}")

    with open(schema_path) as f:
        schema_sql = f.read()

    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(schema_sql)
        conn.commit()
        cur.close()
        conn.close()

        console.print("[green]Schema initialized successfully[/]")
        return True

    except Exception as e:
        console.print(f"[red]Failed to initialize schema:[/] {e}")
        return False


def load_race_config(config_path: Path) -> dict:
    """
    Load race configuration from YAML or JSON file.

    Args:
        config_path: Path to config file

    Returns:
        Dict with race configuration
    """
    with open(config_path) as f:
        if config_path.suffix in (".yaml", ".yml"):
            return yaml.safe_load(f)
        else:
            return json.load(f)


def insert_race(config: dict, update_if_exists: bool = False) -> Optional[str]:
    """
    Insert a race from configuration dict.

    Args:
        config: Race configuration dict
        update_if_exists: If True, update existing race with same slug

    Returns:
        Race ID if successful, None otherwise
    """
    # Required fields for the database
    required_fields = ["slug", "name", "distance_meters", "capture_date", "storage_prefix"]
    for field in required_fields:
        if field not in config:
            console.print(f"[red]Missing required field:[/] {field}")
            return None

    # Handle storage_bucket: if not in config, try environment variable
    if "storage_bucket" not in config:
        from dotenv import load_dotenv
        # Try to load .env files from workspace root
        root_dir = Path(__file__).parent.parent.parent.parent.parent
        for env_file in [".env.local", ".env"]:
            env_path = root_dir / env_file
            if env_path.exists():
                load_dotenv(env_path)
                break
        
        env_bucket = os.getenv("R2_BUCKET_NAME")
        if env_bucket:
            config["storage_bucket"] = env_bucket
            console.print(f"  [dim]Using bucket from environment: {env_bucket}[/]")
        else:
            console.print("[red]Missing required field: storage_bucket (and R2_BUCKET_NAME not in environment)[/]")
            return None

    conn = get_connection()
    cur = conn.cursor()

    try:
        # Check if race exists
        cur.execute("SELECT id FROM races WHERE slug = %s", (config["slug"],))
        existing = cur.fetchone()

        if existing:
            if update_if_exists:
                return _update_race(cur, conn, existing[0], config)
            else:
                console.print(f"[yellow]Race already exists:[/] {config['slug']}")
                console.print("  Use --update to update existing race")
                return None

        # Insert new race
        fields = [
            "slug", "name", "description", "flag_emoji", "recorded_year",
            "recorded_by", "distance_meters", "race_date", "city", "country",
            "elevation_gain", "elevation_loss", "elevation_bars", "minimap_url",
            "card_image_url", "tier", "total_images", "capture_date", "capture_device",
            "status", "storage_bucket", "storage_prefix"
        ]

        # Build insert query with only fields that are present
        insert_fields = []
        insert_values = []
        placeholders = []

        for field in fields:
            if field in config:
                insert_fields.append(field)
                value = config[field]

                # Handle special types
                if field == "elevation_bars" and isinstance(value, list):
                    value = json.dumps(value)
                elif field in ("race_date", "capture_date") and isinstance(value, str):
                    value = datetime.fromisoformat(value).date() if "T" in value else date.fromisoformat(value)

                insert_values.append(value)
                placeholders.append("%s")

        query = f"""
            INSERT INTO races ({', '.join(insert_fields)})
            VALUES ({', '.join(placeholders)})
            RETURNING id
        """

        cur.execute(query, insert_values)
        race_id = cur.fetchone()[0]
        conn.commit()

        console.print(f"[green]Race inserted:[/] {config['slug']} (id: {race_id})")
        return str(race_id)

    except Exception as e:
        conn.rollback()
        console.print(f"[red]Failed to insert race:[/] {e}")
        return None

    finally:
        cur.close()
        conn.close()


def _update_race(cur, conn, race_id: str, config: dict) -> Optional[str]:
    """Update an existing race."""
    fields = [
        "name", "description", "flag_emoji", "recorded_year", "recorded_by",
        "distance_meters", "race_date", "city", "country", "elevation_gain",
        "elevation_loss", "elevation_bars", "minimap_url", "card_image_url",
        "tier", "total_images", "capture_date", "capture_device", "status",
        "storage_bucket", "storage_prefix"
    ]

    update_parts = []
    update_values = []

    for field in fields:
        if field in config:
            update_parts.append(f"{field} = %s")
            value = config[field]

            # Handle special types
            if field == "elevation_bars" and isinstance(value, list):
                value = json.dumps(value)
            elif field in ("race_date", "capture_date") and isinstance(value, str):
                value = datetime.fromisoformat(value).date() if "T" in value else date.fromisoformat(value)

            update_values.append(value)

    if not update_parts:
        console.print("[yellow]No fields to update[/]")
        return str(race_id)

    update_values.append(race_id)
    query = f"""
        UPDATE races
        SET {', '.join(update_parts)}
        WHERE id = %s
    """

    try:
        cur.execute(query, update_values)
        conn.commit()
        console.print(f"[green]Race updated:[/] {config['slug']} (id: {race_id})")
        return str(race_id)
    except Exception as e:
        conn.rollback()
        console.print(f"[red]Failed to update race:[/] {e}")
        return None


def insert_images(race_id: str, records: list[dict]) -> bool:
    """
    Insert image records into the database.

    Args:
        race_id: UUID of the race these images belong to
        records: List of image metadata dicts (from db_records.json)

    Returns:
        True if successful
    """
    if not records:
        console.print("[yellow]No image records to insert[/]")
        return True

    conn = get_connection()
    cur = conn.cursor()

    try:
        console.print(f"[bold]Inserting {len(records)} images for race {race_id}[/]")

        # Prepare the insert query
        fields = [
            "race_id", "position_index", "latitude", "longitude", "altitude_meters",
            "captured_at", "heading_degrees", "heading_to_prev", "heading_to_next",
            "distance_from_start",
            "path_thumbnail", "path_medium", "path_full",
            "has_blur_applied"
        ]

        placeholders = ", ".join(["%s"] * len(fields))
        query = f"INSERT INTO images ({', '.join(fields)}) VALUES ({placeholders}) ON CONFLICT (race_id, position_index) DO UPDATE SET "
        
        # Build the update part for conflict
        update_parts = [f"{f} = EXCLUDED.{f}" for f in fields if f not in ("race_id", "position_index")]
        query += ", ".join(update_parts)

        # Prepare values
        values = []
        for rec in records:
            row = [
                race_id,
                rec["position_index"],
                rec.get("latitude"),
                rec.get("longitude"),
                rec.get("altitude_meters"),
                rec.get("captured_at"),
                rec.get("heading_degrees"),
                rec.get("heading_to_prev"),
                rec.get("heading_to_next"),
                rec.get("distance_from_start"),
                rec["path_thumbnail"],
                rec["path_medium"],
                rec["path_full"],
                rec.get("has_blur_applied", True)
            ]
            values.append(tuple(row))

        # Use execute_batch for better performance
        from psycopg2.extras import execute_batch
        execute_batch(cur, query, values)
        
        # Update the total_images count in the races table
        cur.execute(
            "UPDATE races SET total_images = (SELECT COUNT(*) FROM images WHERE race_id = %s) WHERE id = %s",
            (race_id, race_id)
        )
        
        conn.commit()
        console.print(f"[green]Successfully inserted/updated {len(records)} images[/]")
        return True

    except Exception as e:
        conn.rollback()
        console.print(f"[red]Failed to insert images:[/] {e}")
        return False
    finally:
        cur.close()
        conn.close()


def list_races(status: Optional[str] = None) -> list[dict]:
    """
    List all races.

    Args:
        status: Filter by status (pending, processing, ready, error)

    Returns:
        List of race dicts
    """
    conn = get_connection()
    cur = conn.cursor()

    try:
        if status:
            cur.execute(
                "SELECT id, slug, name, status, total_images, capture_date FROM races WHERE status = %s ORDER BY created_at DESC",
                (status,)
            )
        else:
            cur.execute(
                "SELECT id, slug, name, status, total_images, capture_date FROM races ORDER BY created_at DESC"
            )

        rows = cur.fetchall()
        races = []
        for row in rows:
            races.append({
                "id": str(row[0]),
                "slug": row[1],
                "name": row[2],
                "status": row[3],
                "total_images": row[4],
                "capture_date": row[5].isoformat() if row[5] else None,
            })

        return races

    finally:
        cur.close()
        conn.close()


def get_race(slug_or_id: str) -> Optional[dict]:
    """
    Get race details by slug or ID.

    Args:
        slug_or_id: Race slug or UUID

    Returns:
        Race dict or None if not found
    """
    conn = get_connection()
    cur = conn.cursor()

    try:
        # Try as UUID first
        try:
            cur.execute("SELECT * FROM races WHERE id = %s", (slug_or_id,))
            row = cur.fetchone()
        except Exception:
            # If UUID fails (e.g. invalid syntax), rollback and try as slug
            conn.rollback()
            cur.execute("SELECT * FROM races WHERE slug = %s", (slug_or_id,))
            row = cur.fetchone()

        if not row:
            return None

        # Get column names
        columns = [desc[0] for desc in cur.description]
        race = dict(zip(columns, row))

        # Convert special types
        for key, value in race.items():
            if isinstance(value, (date, datetime)):
                race[key] = value.isoformat()
            elif hasattr(value, "__str__") and key == "id":
                race[key] = str(value)

        return race

    finally:
        cur.close()
        conn.close()


def delete_race(slug_or_id: str) -> bool:
    """
    Delete a race by slug or ID.

    Args:
        slug_or_id: Race slug or UUID

    Returns:
        True if deleted, False otherwise
    """
    conn = get_connection()
    cur = conn.cursor()

    try:
        # Try as UUID first, then as slug
        try:
            cur.execute("DELETE FROM races WHERE id = %s RETURNING slug", (slug_or_id,))
        except Exception:
            conn.rollback()
            cur.execute("DELETE FROM races WHERE slug = %s RETURNING slug", (slug_or_id,))

        if cur.rowcount == 0:
            cur.execute("DELETE FROM races WHERE slug = %s RETURNING slug", (slug_or_id,))

        result = cur.fetchone()
        if result:
            conn.commit()
            console.print(f"[green]Deleted race:[/] {result[0]}")
            return True
        else:
            console.print(f"[yellow]Race not found:[/] {slug_or_id}")
            return False

    except Exception as e:
        conn.rollback()
        console.print(f"[red]Failed to delete race:[/] {e}")
        return False

    finally:
        cur.close()
        conn.close()


def print_races_table(races: list[dict]) -> None:
    """Print races as a formatted table."""
    if not races:
        console.print("[yellow]No races found[/]")
        return

    table = Table(title="Races")
    table.add_column("Slug", style="cyan")
    table.add_column("Name", style="white")
    table.add_column("Status", style="green")
    table.add_column("Images", style="yellow")
    table.add_column("Capture Date", style="dim")

    for race in races:
        status_style = {
            "pending": "yellow",
            "processing": "blue",
            "ready": "green",
            "error": "red",
        }.get(race["status"], "white")

        table.add_row(
            race["slug"],
            race["name"],
            f"[{status_style}]{race['status']}[/]",
            str(race["total_images"]),
            race["capture_date"] or "N/A",
        )

    console.print(table)


def update_race_gpx_stats(
    slug_or_id: str,
    distance_meters: int,
    elevation_gain: int,
    elevation_loss: int,
) -> bool:
    """
    Update a race's distance and elevation data from GPX-derived stats.

    Args:
        slug_or_id: Race slug or UUID
        distance_meters: Total distance in meters
        elevation_gain: Total elevation gain in meters
        elevation_loss: Total elevation loss in meters

    Returns:
        True if successful
    """
    conn = get_connection()
    cur = conn.cursor()

    try:
        # Try as UUID first, then as slug
        try:
            cur.execute(
                """
                UPDATE races
                SET distance_meters = %s, elevation_gain = %s, elevation_loss = %s
                WHERE id = %s
                RETURNING slug
                """,
                (distance_meters, elevation_gain, elevation_loss, slug_or_id)
            )
        except Exception:
            conn.rollback()
            cur.execute(
                """
                UPDATE races
                SET distance_meters = %s, elevation_gain = %s, elevation_loss = %s
                WHERE slug = %s
                RETURNING slug
                """,
                (distance_meters, elevation_gain, elevation_loss, slug_or_id)
            )

        result = cur.fetchone()
        if result:
            conn.commit()
            console.print(f"[green]Updated race:[/] {result[0]}")
            console.print(f"  Distance: {distance_meters:,} m ({distance_meters/1000:.2f} km)")
            console.print(f"  Elevation gain: {elevation_gain:,} m")
            console.print(f"  Elevation loss: {elevation_loss:,} m")
            return True
        else:
            console.print(f"[yellow]Race not found:[/] {slug_or_id}")
            return False

    except Exception as e:
        conn.rollback()
        console.print(f"[red]Failed to update race:[/] {e}")
        return False

    finally:
        cur.close()
        conn.close()


def print_race_details(race: dict) -> None:
    """Print race details as a formatted table."""
    table = Table(title=f"Race: {race.get('name', 'Unknown')}")
    table.add_column("Field", style="cyan")
    table.add_column("Value", style="white")

    # Key fields to display
    key_fields = [
        ("id", "ID"),
        ("slug", "Slug"),
        ("name", "Name"),
        ("description", "Description"),
        ("status", "Status"),
        ("flag_emoji", "Flag"),
        ("city", "City"),
        ("country", "Country"),
        ("distance_meters", "Distance (m)"),
        ("elevation_gain", "Elevation Gain (m)"),
        ("elevation_loss", "Elevation Loss (m)"),
        ("total_images", "Total Images"),
        ("capture_date", "Capture Date"),
        ("capture_device", "Capture Device"),
        ("recorded_by", "Recorded By"),
        ("recorded_year", "Recorded Year"),
        ("tier", "Tier"),
        ("storage_bucket", "Storage Bucket"),
        ("storage_prefix", "Storage Prefix"),
        ("created_at", "Created At"),
        ("updated_at", "Updated At"),
    ]

    for field, label in key_fields:
        value = race.get(field)
        if value is not None:
            table.add_row(label, str(value))

    console.print(table)

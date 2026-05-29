import { pool } from "@workspace/db";
import { logger } from "./logger";

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ladu_flavors (
        id         SERIAL PRIMARY KEY,
        user_id    TEXT NOT NULL,
        name       TEXT NOT NULL,
        default_cap_id INTEGER
      );

      CREATE TABLE IF NOT EXISTS ladu_bottles (
        id      SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        size    INTEGER NOT NULL,
        qty     INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS ladu_labels (
        id        SERIAL PRIMARY KEY,
        user_id   TEXT NOT NULL,
        flavor_id INTEGER NOT NULL,
        size      INTEGER NOT NULL,
        qty       INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS ladu_caps (
        id      SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        size    INTEGER NOT NULL,
        type    TEXT NOT NULL DEFAULT '',
        color   TEXT NOT NULL DEFAULT '',
        qty     INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS ladu_wire_cages (
        id      SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        qty     INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS ladu_custom_label_bottles (
        id      SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        size    INTEGER NOT NULL,
        qty     INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS ladu_reusable_caps (
        id      SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        size    INTEGER NOT NULL,
        qty     INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS ladu_movements (
        id         SERIAL PRIMARY KEY,
        user_id    TEXT NOT NULL,
        type       TEXT NOT NULL,
        summary    TEXT NOT NULL,
        deltas     JSONB NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ladu_blank_label_types (
        id      SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        name    TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ladu_blank_labels (
        id                   SERIAL PRIMARY KEY,
        user_id              TEXT NOT NULL,
        blank_label_type_id  INTEGER NOT NULL,
        size                 INTEGER NOT NULL,
        qty                  INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS ladu_finished_goods (
        id        SERIAL PRIMARY KEY,
        user_id   TEXT NOT NULL,
        flavor_id INTEGER NOT NULL,
        size      INTEGER NOT NULL,
        qty       INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS ladu_materials (
        id      SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        name    TEXT NOT NULL,
        unit    TEXT NOT NULL,
        qty     REAL NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS tea_stock (
        id      SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        name    TEXT NOT NULL,
        qty_g   INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS brews (
        id                SERIAL PRIMARY KEY,
        user_id           TEXT NOT NULL,
        created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
        date              TEXT NOT NULL,
        boiled_l          REAL NOT NULL,
        start_boil_time   TEXT NOT NULL DEFAULT '',
        temp_reached_min  INTEGER,
        temp              INTEGER,
        tea_stock_id      INTEGER,
        tea_sort          TEXT NOT NULL DEFAULT '',
        tea_g             INTEGER NOT NULL DEFAULT 0,
        steep_min         INTEGER DEFAULT 10,
        steep_heat        INTEGER DEFAULT 0,
        sugar_g           INTEGER NOT NULL DEFAULT 0,
        cold_water_l      REAL NOT NULL DEFAULT 0,
        cool_start_time   TEXT NOT NULL DEFAULT '',
        cool_place        TEXT NOT NULL DEFAULT '',
        cool_temp         INTEGER,
        continued_time    TEXT NOT NULL DEFAULT '',
        notes             TEXT NOT NULL DEFAULT '',
        starter_pct       INTEGER NOT NULL DEFAULT 20,
        starter_g         INTEGER NOT NULL DEFAULT 0,
        electricity_kwh   REAL
      );

      CREATE TABLE IF NOT EXISTS fermentation_batch (
        id              SERIAL PRIMARY KEY,
        user_id         TEXT NOT NULL,
        created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
        brew_id         INTEGER,
        tea_sort        TEXT NOT NULL DEFAULT '',
        start_date      TEXT NOT NULL,
        flavoring_date  TEXT,
        notes           TEXT NOT NULL DEFAULT '',
        vessels         JSONB NOT NULL
      );

      CREATE TABLE IF NOT EXISTS flavoring_stock (
        id          SERIAL PRIMARY KEY,
        user_id     TEXT NOT NULL,
        name        TEXT NOT NULL,
        olek        TEXT NOT NULL DEFAULT '',
        paritolu    TEXT NOT NULL DEFAULT '',
        coefficient REAL NOT NULL DEFAULT 1.3,
        qty_g       REAL NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS processing_method (
        id      SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        name    TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS flavoring_event (
        id                    SERIAL PRIMARY KEY,
        user_id               TEXT NOT NULL,
        created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
        date                  TEXT NOT NULL,
        fermentation_batch_id INTEGER,
        bottling_date         TEXT,
        bottle_ferment_note   TEXT NOT NULL DEFAULT '',
        notes                 TEXT NOT NULL DEFAULT '',
        blocks                JSONB NOT NULL
      );
    `);
    await client.query(`DROP TABLE IF EXISTS ladu_labeled_bottles`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS brew_sessions (
        id      SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        date    TEXT NOT NULL
      );
      ALTER TABLE brews ADD COLUMN IF NOT EXISTS sugar_stock_id INTEGER;
      ALTER TABLE brews ADD COLUMN IF NOT EXISTS session_id INTEGER;
    `);
    await client.query(`
      ALTER TABLE fermentation_batch ADD COLUMN IF NOT EXISTS starter_source_batch_id INTEGER;
    `);
    await client.query(`
      ALTER TABLE bottle_tests ADD COLUMN IF NOT EXISTS flavoring_event_id INTEGER;
    `);
    await client.query(`
      ALTER TABLE photos DROP CONSTRAINT IF EXISTS photos_batch_id_fkey;
      ALTER TABLE photos ALTER COLUMN batch_id DROP NOT NULL;
      ALTER TABLE photos ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
      ALTER TABLE photos ADD COLUMN IF NOT EXISTS phase TEXT;
      ALTER TABLE photos ADD COLUMN IF NOT EXISTS stage_ref_id INTEGER;
      ALTER TABLE photos ADD COLUMN IF NOT EXISTS photo_date TEXT;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ladu_returned_bottles (
        id        SERIAL PRIMARY KEY,
        user_id   TEXT NOT NULL,
        flavor_id INTEGER NOT NULL,
        size      INTEGER NOT NULL,
        qty       INTEGER NOT NULL DEFAULT 0
      );
    `);
    await client.query(`
      ALTER TABLE flavoring_event ADD COLUMN IF NOT EXISTS saved_starter_g INTEGER;
    `);
    await client.query(`
      ALTER TABLE ladu_materials ADD COLUMN IF NOT EXISTS min_stock REAL;
    `);
    await client.query(`
      DELETE FROM ladu_reusable_caps WHERE size != 750;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS sugar_stock_movements (
        id              SERIAL PRIMARY KEY,
        user_id         TEXT NOT NULL,
        sugar_stock_id  INTEGER NOT NULL,
        delta_g         INTEGER NOT NULL,
        reason          TEXT NOT NULL,
        brew_id         INTEGER,
        note            TEXT,
        created_at      TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // One-time consolidation: merge all named blank label types into __default__ per user.
    // Idempotent — already-zeroed or deleted rows are skipped.

    // 1. Ensure every user who has any blank label type also has a __default__ type.
    await client.query(`
      INSERT INTO ladu_blank_label_types (user_id, name)
      SELECT DISTINCT user_id, '__default__'
      FROM ladu_blank_label_types
      WHERE user_id NOT IN (
        SELECT user_id FROM ladu_blank_label_types WHERE name = '__default__'
      );
    `);

    // 2a. Add non-default stock into existing default rows (per user+size).
    await client.query(`
      UPDATE ladu_blank_labels AS target
      SET qty = target.qty + source.agg_qty
      FROM (
        SELECT dt.id AS default_type_id, nd.size, SUM(nd.qty) AS agg_qty
        FROM ladu_blank_labels nd
        JOIN ladu_blank_label_types nt ON nt.id = nd.blank_label_type_id AND nt.name != '__default__'
        JOIN ladu_blank_label_types dt ON dt.user_id = nd.user_id AND dt.name = '__default__'
        WHERE nd.qty != 0
        GROUP BY dt.id, nd.size
      ) source
      WHERE target.blank_label_type_id = source.default_type_id
        AND target.size = source.size;
    `);

    // 2b. Insert new default rows for sizes that have no existing default row yet.
    await client.query(`
      INSERT INTO ladu_blank_labels (user_id, blank_label_type_id, size, qty)
      SELECT nd.user_id, dt.id, nd.size, SUM(nd.qty)
      FROM ladu_blank_labels nd
      JOIN ladu_blank_label_types nt ON nt.id = nd.blank_label_type_id AND nt.name != '__default__'
      JOIN ladu_blank_label_types dt ON dt.user_id = nd.user_id AND dt.name = '__default__'
      WHERE nd.qty != 0
        AND NOT EXISTS (
          SELECT 1 FROM ladu_blank_labels ex
          WHERE ex.blank_label_type_id = dt.id AND ex.size = nd.size
        )
      GROUP BY nd.user_id, dt.id, nd.size;
    `);

    // 3. Delete all ladu_blank_labels rows belonging to non-default types.
    await client.query(`
      DELETE FROM ladu_blank_labels
      WHERE blank_label_type_id IN (
        SELECT id FROM ladu_blank_label_types WHERE name != '__default__'
      );
    `);

    // 4. Delete the non-default type definitions themselves.
    await client.query(`
      DELETE FROM ladu_blank_label_types WHERE name != '__default__';
    `);

    await client.query(`
      ALTER TABLE tea_stock ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE sugar_stock ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;
    `);
    await client.query(`
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tea_ratio_g_per_l REAL NOT NULL DEFAULT 5;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tea_base_g REAL NOT NULL DEFAULT 5;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sugar_ratio_g_per_l REAL NOT NULL DEFAULT 80;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS team_invites (
        id           SERIAL PRIMARY KEY,
        owner_user_id TEXT NOT NULL,
        token        TEXT NOT NULL UNIQUE,
        status       TEXT NOT NULL DEFAULT 'pending',
        expires_at   TIMESTAMP NOT NULL,
        created_at   TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS team_members (
        id             SERIAL PRIMARY KEY,
        owner_user_id  TEXT NOT NULL,
        member_user_id TEXT NOT NULL,
        invite_id      INTEGER,
        joined_at      TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    logger.info("Migrations complete");
  } finally {
    client.release();
  }
}

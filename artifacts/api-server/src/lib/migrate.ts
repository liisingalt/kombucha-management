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
    logger.info("Migrations complete");
  } finally {
    client.release();
  }
}

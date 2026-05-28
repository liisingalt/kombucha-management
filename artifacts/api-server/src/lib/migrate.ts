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
    `);
    await client.query(`DROP TABLE IF EXISTS ladu_labeled_bottles`);
    logger.info("Migrations complete");
  } finally {
    client.release();
  }
}

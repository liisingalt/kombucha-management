import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

router.post("/migrate-ladu-temp", async (_req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ladu_flavors (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        default_cap_id INTEGER
      );
      CREATE TABLE IF NOT EXISTS ladu_bottles (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        size INTEGER NOT NULL,
        qty INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS ladu_labels (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        flavor_id INTEGER NOT NULL,
        size INTEGER NOT NULL,
        qty INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS ladu_caps (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        size INTEGER NOT NULL,
        type TEXT NOT NULL DEFAULT '',
        color TEXT NOT NULL DEFAULT '',
        qty INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS ladu_movements (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        summary TEXT NOT NULL,
        deltas JSONB NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    res.json({ ok: true, message: "Ladu tables created" });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;

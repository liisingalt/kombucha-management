import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const sql = `
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
`;

try {
  await client.query(sql);
  console.log("Ladu tables created successfully.");
} catch (e) {
  console.error("Migration failed:", e.message);
  process.exit(1);
} finally {
  await client.end();
}

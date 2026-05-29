import { pool } from "@workspace/db";
import { objectStorageClient } from "./objectStorage";
import { runMigrations } from "./migrate";
import { logger } from "./logger";

const MAX_BACKUPS = 30;

function getBackupBucketAndPrefix(): { bucketName: string; prefix: string } {
  const privateDir = process.env["PRIVATE_OBJECT_DIR"] || "";
  if (!privateDir) {
    throw new Error(
      "PRIVATE_OBJECT_DIR not set — cannot determine backup storage location"
    );
  }
  const normalized = privateDir.startsWith("/") ? privateDir : `/${privateDir}`;
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length < 1) {
    throw new Error(`Invalid PRIVATE_OBJECT_DIR: "${privateDir}"`);
  }
  const bucketName = parts[0];
  return { bucketName, prefix: "backups" };
}

export interface BackupInfo {
  filename: string;
  timestamp: string;
  sizeBytes: number;
}

export async function listBackups(): Promise<BackupInfo[]> {
  const { bucketName, prefix } = getBackupBucketAndPrefix();
  const bucket = objectStorageClient.bucket(bucketName);
  const [files] = await bucket.getFiles({ prefix: `${prefix}/` });

  const infos: BackupInfo[] = files
    .filter((f) => f.name.endsWith(".sql"))
    .map((f) => {
      const metadata = f.metadata as { size?: string | number };
      const sizeBytes = Number(metadata.size ?? 0);
      const isoName = f.name.replace(`${prefix}/`, "");
      const timestamp = isoName.replace(".sql", "");
      return { filename: isoName, timestamp, sizeBytes };
    });

  infos.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return infos;
}

function escapeLiteral(val: unknown): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  if (typeof val === "number") return String(val);
  if (val instanceof Date) return `'${val.toISOString().replace(/'/g, "''")}'`;
  if (typeof val === "object") {
    return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  }
  const str = String(val);
  if (str.includes("\0")) {
    throw new Error("String contains null bytes — cannot safely serialize");
  }
  return `'${str.replace(/'/g, "''")}'`;
}

async function dumpDatabase(): Promise<string> {
  const client = await pool.connect();
  try {
    const tablesResult = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );
    const tables = tablesResult.rows.map((r) => r.tablename);

    const lines: string[] = [];
    lines.push("-- Kombucha Tracker DB Backup");
    lines.push(`-- Generated: ${new Date().toISOString()}`);
    lines.push(
      "-- Restore: single transaction; schema is bootstrapped by migrations before data load"
    );
    lines.push("");
    lines.push("BEGIN;");
    lines.push("");
    lines.push(
      "-- Disable FK/trigger checks so TRUNCATE+INSERT works regardless of reference order"
    );
    lines.push("SET LOCAL session_replication_role = replica;");
    lines.push("");

    if (tables.length > 0) {
      const tableList = tables.map((t) => `"${t}"`).join(", ");
      lines.push("-- Clear all data; RESTART IDENTITY resets sequence counters");
      lines.push(`TRUNCATE TABLE ${tableList} RESTART IDENTITY;`);
      lines.push("");
    }

    for (const table of tables) {
      const colsResult = await client.query<{
        column_name: string;
        is_serial: boolean;
      }>(
        `SELECT column_name,
                (column_default LIKE 'nextval%' OR identity_generation IS NOT NULL) AS is_serial
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position`,
        [table]
      );

      const columns = colsResult.rows.map((r) => r.column_name);
      const serialCols = colsResult.rows
        .filter((r) => r.is_serial)
        .map((r) => r.column_name);

      if (columns.length === 0) continue;

      const rowsResult = await client.query(
        `SELECT * FROM "${table}" ORDER BY 1`
      );

      if (rowsResult.rows.length > 0) {
        lines.push(`-- Data for table: ${table}`);
        for (const row of rowsResult.rows) {
          const colList = columns.map((c) => `"${c}"`).join(", ");
          const valList = columns.map((c) => escapeLiteral(row[c])).join(", ");
          lines.push(`INSERT INTO "${table}" (${colList}) VALUES (${valList});`);
        }
        lines.push("");
      }

      if (serialCols.length > 0) {
        lines.push(`-- Advance sequences for table: ${table}`);
        for (const col of serialCols) {
          lines.push(
            `SELECT setval(` +
              `pg_get_serial_sequence('"${table}"', '${col}'), ` +
              `COALESCE((SELECT MAX("${col}") FROM "${table}"), 1), ` +
              `(SELECT MAX("${col}") FROM "${table}") IS NOT NULL` +
              `);`
          );
        }
        lines.push("");
      }
    }

    lines.push("COMMIT;");
    lines.push("");
    return lines.join("\n");
  } finally {
    client.release();
  }
}

export async function createBackup(): Promise<BackupInfo> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${timestamp}.sql`;

  logger.info({ filename }, "Starting database backup");

  const sql = await dumpDatabase();

  const { bucketName, prefix } = getBackupBucketAndPrefix();
  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(`${prefix}/${filename}`);

  await file.save(Buffer.from(sql, "utf8"), { contentType: "text/plain" });

  logger.info({ filename }, "Backup saved to object storage");

  await pruneOldBackups(bucketName, prefix);

  const [metadata] = await file.getMetadata();
  const sizeBytes = Number(
    (metadata as { size?: string | number }).size ?? 0
  );

  return { filename, timestamp, sizeBytes };
}

async function pruneOldBackups(
  bucketName: string,
  prefix: string
): Promise<void> {
  const bucket = objectStorageClient.bucket(bucketName);
  const [files] = await bucket.getFiles({ prefix: `${prefix}/` });

  const sqlFiles = files
    .filter((f) => f.name.endsWith(".sql"))
    .sort((a, b) => b.name.localeCompare(a.name));

  if (sqlFiles.length > MAX_BACKUPS) {
    const toDelete = sqlFiles.slice(MAX_BACKUPS);
    for (const f of toDelete) {
      await f.delete();
      logger.info({ name: f.name }, "Pruned old backup");
    }
  }
}

export async function restoreBackup(filename: string): Promise<void> {
  const { bucketName, prefix } = getBackupBucketAndPrefix();
  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(`${prefix}/${filename}`);

  const [exists] = await file.exists();
  if (!exists) {
    throw new Error(`Backup file not found: ${filename}`);
  }

  logger.info({ filename }, "Downloading backup for restore");
  const [contents] = await file.download();
  const sql = contents.toString("utf8");

  if (!sql.includes("BEGIN;") || !sql.includes("COMMIT;")) {
    throw new Error("Backup file appears corrupt — missing transaction markers");
  }

  logger.info({ filename }, "Running migrations to ensure schema exists before data load");
  await runMigrations();

  logger.info({ filename }, "Restoring database from backup (single transaction)");
  const client = await pool.connect();
  try {
    await client.query(sql);
  } catch (err) {
    throw new Error(
      `Restore failed — transaction rolled back: ${err instanceof Error ? err.message : String(err)}`
    );
  } finally {
    client.release();
  }

  logger.info({ filename }, "Restore complete — running migrations again for forward compatibility");
  await runMigrations();
  logger.info({ filename }, "All done after restore");
}

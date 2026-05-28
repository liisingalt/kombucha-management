import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations } from "./lib/migrate";
import { createBackup } from "./lib/backup";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

function scheduleBackups() {
  createBackup()
    .then((info) => logger.info({ filename: info.filename }, "Initial backup complete"))
    .catch((err) => logger.error({ err }, "Initial backup failed"));

  setInterval(() => {
    createBackup()
      .then((info) => logger.info({ filename: info.filename }, "Scheduled backup complete"))
      .catch((err) => logger.error({ err }, "Scheduled backup failed"));
  }, FOUR_HOURS_MS);
}

runMigrations()
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
      scheduleBackups();
    });
  })
  .catch((err) => {
    logger.error({ err }, "Migration failed — aborting startup");
    process.exit(1);
  });

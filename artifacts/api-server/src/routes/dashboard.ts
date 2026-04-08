import { Router } from "express";
import { db } from "@workspace/db";
import { batchesTable, logsTable, photosTable } from "@workspace/db";
import { eq, and, count, desc, inArray } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router = Router();

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

router.get("/dashboard/summary", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;

  try {
    const allBatches = await db.query.batchesTable.findMany({
      where: eq(batchesTable.userId, userId),
    });

    const activeBatches = allBatches.filter(b => b.status === "active");
    const batchIds = allBatches.map(b => b.id);

    const activeBatchesWithCounts = await Promise.all(
      activeBatches.slice(0, 5).map(async (batch) => {
        const [logCountResult] = await db
          .select({ count: count() })
          .from(logsTable)
          .where(eq(logsTable.batchId, batch.id));
        const [photoCountResult] = await db
          .select({ count: count() })
          .from(photosTable)
          .where(eq(photosTable.batchId, batch.id));

        return {
          ...batch,
          logCount: Number(logCountResult?.count ?? 0),
          photoCount: Number(photoCountResult?.count ?? 0),
          daysSinceStart: daysSince(batch.startedAt),
        };
      })
    );

    let totalPhotoCount = 0;
    let recentLogs: (typeof logsTable.$inferSelect)[] = [];

    if (batchIds.length > 0) {
      const [photoCountResult] = await db
        .select({ count: count() })
        .from(photosTable)
        .where(inArray(photosTable.batchId, batchIds));
      totalPhotoCount = Number(photoCountResult?.count ?? 0);

      recentLogs = await db.query.logsTable.findMany({
        where: inArray(logsTable.batchId, batchIds),
        orderBy: [desc(logsTable.loggedAt)],
        limit: 5,
      });
    }

    res.json({
      activeBatchCount: activeBatches.length,
      totalBatchCount: allBatches.length,
      totalPhotoCount,
      recentLogs,
      activeBatches: activeBatchesWithCounts,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

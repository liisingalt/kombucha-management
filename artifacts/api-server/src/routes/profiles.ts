import { Router } from "express";
import { db } from "@workspace/db";
import { profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router = Router();

router.get("/profile", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  try {
    let profile = await db.query.profilesTable.findFirst({
      where: eq(profilesTable.clerkUserId, userId),
    });
    if (!profile) {
      [profile] = await db.insert(profilesTable).values({ clerkUserId: userId }).returning();
    }
    res.json(profile);
  } catch (err) {
    req.log.error({ err }, "Failed to get profile");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/profile", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const {
    hasCompletedOnboarding,
    hasMadeBefore,
    hasScoby,
    currentStage,
    experienceLevel,
    flavorPreference,
    onboardingAdvice,
    ttsEnabled,
  } = req.body;

  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (hasCompletedOnboarding !== undefined) updates.hasCompletedOnboarding = hasCompletedOnboarding;
    if (hasMadeBefore !== undefined) updates.hasMadeBefore = hasMadeBefore;
    if (hasScoby !== undefined) updates.hasScoby = hasScoby;
    if (currentStage !== undefined) updates.currentStage = currentStage;
    if (experienceLevel !== undefined) updates.experienceLevel = experienceLevel;
    if (flavorPreference !== undefined) updates.flavorPreference = flavorPreference;
    if (onboardingAdvice !== undefined) updates.onboardingAdvice = onboardingAdvice;
    if (ttsEnabled !== undefined) updates.ttsEnabled = ttsEnabled;

    let profile = await db.query.profilesTable.findFirst({
      where: eq(profilesTable.clerkUserId, userId),
    });

    if (!profile) {
      [profile] = await db.insert(profilesTable)
        .values({ clerkUserId: userId, ...updates })
        .returning();
    } else {
      [profile] = await db.update(profilesTable)
        .set(updates)
        .where(eq(profilesTable.clerkUserId, userId))
        .returning();
    }

    res.json(profile);
  } catch (err) {
    req.log.error({ err }, "Failed to update profile");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

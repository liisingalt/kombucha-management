import { Router } from "express";
import { clerkClient } from "@clerk/express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { teamInvitesTable, teamMembersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router = Router();

router.post("/team/invite", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  try {
    const token = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.insert(teamInvitesTable).values({
      ownerUserId: userId,
      token,
      status: "pending",
      expiresAt,
    });
    res.json({ ok: true, token });
  } catch (err) {
    req.log.error({ err }, "Failed to create invite");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/team/members", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  try {
    const members = await db
      .select()
      .from(teamMembersTable)
      .where(eq(teamMembersTable.ownerUserId, userId));

    const enriched = await Promise.all(
      members.map(async (m) => {
        try {
          const user = await clerkClient.users.getUser(m.memberUserId);
          const email =
            user.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??
            user.emailAddresses?.[0]?.emailAddress ??
            "";
          const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || email;
          return { id: m.id, memberUserId: m.memberUserId, name, email, joinedAt: m.joinedAt };
        } catch {
          return { id: m.id, memberUserId: m.memberUserId, name: m.memberUserId, email: "", joinedAt: m.joinedAt };
        }
      })
    );
    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch team members");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/team/members/:id", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = Number(req.params.id);
  try {
    await db
      .delete(teamMembersTable)
      .where(and(eq(teamMembersTable.id, id), eq(teamMembersTable.ownerUserId, userId)));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to remove team member");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/team/accept/:token", requireAuth, async (req, res) => {
  const { actualUserId, userId } = req as AuthenticatedRequest;
  const token = String(req.params["token"] ?? "");
  try {
    const [invite] = await db
      .select()
      .from(teamInvitesTable)
      .where(and(eq(teamInvitesTable.token, token), eq(teamInvitesTable.status, "pending")));

    if (!invite) {
      res.status(404).json({ error: "Kutse ei leitud või on aegunud" });
      return;
    }
    if (new Date(invite.expiresAt) < new Date()) {
      res.status(410).json({ error: "Kutse on aegunud" });
      return;
    }
    if (invite.ownerUserId === actualUserId) {
      res.status(400).json({ error: "Sa ei saa iseendale liitu" });
      return;
    }

    const existing = await db
      .select()
      .from(teamMembersTable)
      .where(
        and(
          eq(teamMembersTable.ownerUserId, invite.ownerUserId),
          eq(teamMembersTable.memberUserId, actualUserId)
        )
      );
    if (existing.length > 0) {
      res.json({ ok: true, alreadyMember: true, ownerUserId: invite.ownerUserId });
      return;
    }

    await db.transaction(async (tx) => {
      await tx.insert(teamMembersTable).values({
        ownerUserId: invite.ownerUserId,
        memberUserId: actualUserId,
        inviteId: invite.id,
      });
      await tx
        .update(teamInvitesTable)
        .set({ status: "accepted" })
        .where(eq(teamInvitesTable.id, invite.id));
    });

    res.json({ ok: true, alreadyMember: false, ownerUserId: invite.ownerUserId });
  } catch (err) {
    req.log.error({ err }, "Failed to accept invite");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/team/invites", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  try {
    const invites = await db
      .select()
      .from(teamInvitesTable)
      .where(and(eq(teamInvitesTable.ownerUserId, userId), eq(teamInvitesTable.status, "pending")));
    res.json(invites);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch invites");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/team/invites/:id", requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = Number(req.params.id);
  try {
    await db
      .update(teamInvitesTable)
      .set({ status: "revoked" })
      .where(and(eq(teamInvitesTable.id, id), eq(teamInvitesTable.ownerUserId, userId)));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to revoke invite");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

import { Router } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { requireAdmin } from "../middlewares/requireAdmin";
import type { AuthenticatedRequest } from "../middlewares/requireAuth";

const router = Router();

const SUPER_ADMIN_EMAIL = "liisingalt@gmail.com";

async function isAdminUser(userId: string): Promise<boolean> {
  const adminIds = (process.env["ADMIN_USER_IDS"] ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (adminIds.includes(userId)) return true;

  try {
    const user = await clerkClient.users.getUser(userId);
    const meta = user.publicMetadata as Record<string, unknown>;
    if (meta["isAdmin"] === true) return true;
  } catch {
  }

  return false;
}

async function getSuperAdminUserId(): Promise<string | null> {
  const envIds = (process.env["ADMIN_USER_IDS"] ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  for (const id of envIds) {
    try {
      const user = await clerkClient.users.getUser(id);
      const email = user.emailAddresses?.find((e) => e.emailAddress === SUPER_ADMIN_EMAIL);
      if (email) return id;
    } catch {
    }
  }

  try {
    const result = await clerkClient.users.getUserList({ emailAddress: [SUPER_ADMIN_EMAIL] });
    if (result.data && result.data.length > 0) {
      return result.data[0].id;
    }
  } catch {
  }

  return null;
}

router.get("/admin/me", async (req, res) => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const admin = await isAdminUser(userId);
  res.json({ isAdmin: admin });
});

router.get("/admin/users", requireAdmin, async (req, res) => {
  try {
    const result = await clerkClient.users.getUserList({ limit: 200 });
    const superAdminId = await getSuperAdminUserId();

    const users = result.data.map((user) => {
      const meta = user.publicMetadata as Record<string, unknown>;
      const isAdmin = meta["isAdmin"] === true;
      const isSuperAdmin = user.id === superAdminId;
      const primaryEmail = user.emailAddresses?.find(
        (e) => e.id === user.primaryEmailAddressId
      )?.emailAddress ?? user.emailAddresses?.[0]?.emailAddress ?? "";

      return {
        id: user.id,
        firstName: user.firstName ?? "",
        lastName: user.lastName ?? "",
        email: primaryEmail,
        isAdmin: isAdmin || isSuperAdmin,
        isSuperAdmin,
      };
    });

    res.json(users);
  } catch (err) {
    req.log.error({ err }, "Failed to list users");
    res.status(500).json({ error: "Failed to list users" });
  }
});

router.post("/admin/users/:userId/set-admin", requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { isAdmin } = req.body as { isAdmin: boolean };

  if (typeof isAdmin !== "boolean") {
    res.status(400).json({ error: "isAdmin must be a boolean" });
    return;
  }

  try {
    const superAdminId = await getSuperAdminUserId();
    if (!isAdmin && superAdminId && userId === superAdminId) {
      res.status(403).json({ error: "Cannot revoke super admin access" });
      return;
    }

    const callerUserId = (req as AuthenticatedRequest).userId;
    if (!isAdmin && userId === callerUserId) {
      res.status(403).json({ error: "Cannot revoke your own admin access" });
      return;
    }

    await clerkClient.users.updateUserMetadata(userId, {
      publicMetadata: { isAdmin },
    });

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to update user admin status");
    res.status(500).json({ error: "Failed to update user admin status" });
  }
});

export default router;

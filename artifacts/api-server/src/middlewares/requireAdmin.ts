import { clerkClient, getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./requireAuth";

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

export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const admin = await isAdminUser(userId);
  if (!admin) {
    res.status(403).json({ error: "Forbidden — admin access required" });
    return;
  }

  (req as AuthenticatedRequest).userId = userId;
  next();
};

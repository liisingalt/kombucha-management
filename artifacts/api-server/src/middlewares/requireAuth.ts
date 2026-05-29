import { getAuth } from "@clerk/express";
import { pool } from "@workspace/db";
import type { Request, Response, NextFunction } from "express";

export interface AuthenticatedRequest extends Request {
  userId: string;
  actualUserId: string;
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const result = await pool.query<{ owner_user_id: string }>(
      "SELECT owner_user_id FROM team_members WHERE member_user_id = $1 LIMIT 1",
      [clerkUserId]
    );
    const ownerUserId = result.rows[0]?.owner_user_id ?? null;
    (req as AuthenticatedRequest).userId = ownerUserId ?? clerkUserId;
    (req as AuthenticatedRequest).actualUserId = clerkUserId;
  } catch {
    (req as AuthenticatedRequest).userId = clerkUserId;
    (req as AuthenticatedRequest).actualUserId = clerkUserId;
  }

  next();
};

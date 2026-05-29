import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

export const teamInvitesTable = pgTable("team_invites", {
  id: serial("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  token: text("token").notNull(),
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const teamMembersTable = pgTable("team_members", {
  id: serial("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  memberUserId: text("member_user_id").notNull(),
  inviteId: integer("invite_id"),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export type TeamInvite = typeof teamInvitesTable.$inferSelect;
export type TeamMember = typeof teamMembersTable.$inferSelect;

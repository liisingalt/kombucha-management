import { pgTable, serial, integer, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { batchesTable } from "./batches";

export const logsTable = pgTable("logs", {
  id: serial("id").primaryKey(),
  batchId: integer("batch_id").notNull().references(() => batchesTable.id, { onDelete: "cascade" }),
  dayNumber: integer("day_number").notNull(),
  temperature: real("temperature"),
  scobylook: text("scobylook"),
  smell: text("smell"),
  color: text("color"),
  notes: text("notes"),
  aiTip: text("ai_tip"),
  taste: text("taste").array(),
  carbonation: text("carbonation"),
  ph: real("ph"),
  activities: text("activities").array(),
  flavourAdditions: text("flavour_additions").array(),
  loggedAt: timestamp("logged_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLogSchema = createInsertSchema(logsTable).omit({
  id: true,
  createdAt: true,
});

export const selectLogSchema = createSelectSchema(logsTable);

export type InsertLog = z.infer<typeof insertLogSchema>;
export type Log = typeof logsTable.$inferSelect;

import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const batchStatusEnum = ["active", "f1_complete", "f2_complete", "archived"] as const;
export type BatchStatus = (typeof batchStatusEnum)[number];

export const batchesTable = pgTable("batches", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  status: text("status").notNull().default("active"),
  teaType: text("tea_type"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertBatchSchema = createInsertSchema(batchesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectBatchSchema = createSelectSchema(batchesTable);

export type InsertBatch = z.infer<typeof insertBatchSchema>;
export type Batch = typeof batchesTable.$inferSelect;

import { pgTable, serial, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

export const fermentationBatchTable = pgTable("fermentation_batch", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  brewId: integer("brew_id"),
  teaSort: text("tea_sort").default(""),
  startDate: text("start_date").notNull(),
  flavoringDate: text("flavoring_date"),
  notes: text("notes").default(""),
  vessels: jsonb("vessels").notNull(),
});

export type FermentationBatch = typeof fermentationBatchTable.$inferSelect;

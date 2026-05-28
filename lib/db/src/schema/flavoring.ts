import { pgTable, serial, text, integer, real, jsonb, timestamp } from "drizzle-orm/pg-core";

export const flavoringStockTable = pgTable("flavoring_stock", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  olek: text("olek").default(""),
  paritolu: text("paritolu").default(""),
  coefficient: real("coefficient").notNull().default(1.3),
  qtyG: real("qty_g").notNull().default(0),
});

export const processingMethodTable = pgTable("processing_method", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
});

export const flavoringEventTable = pgTable("flavoring_event", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  date: text("date").notNull(),
  fermentationBatchId: integer("fermentation_batch_id"),
  bottlingDate: text("bottling_date"),
  bottleFermentNote: text("bottle_ferment_note").default(""),
  notes: text("notes").default(""),
  blocks: jsonb("blocks").notNull(),
});

export type FlavoringStock = typeof flavoringStockTable.$inferSelect;
export type ProcessingMethod = typeof processingMethodTable.$inferSelect;
export type FlavoringEvent = typeof flavoringEventTable.$inferSelect;

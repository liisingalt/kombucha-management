import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { batchesTable } from "./batches";

export const photosTable = pgTable("photos", {
  id: serial("id").primaryKey(),
  batchId: integer("batch_id").notNull().references(() => batchesTable.id, { onDelete: "cascade" }),
  objectPath: text("object_path").notNull(),
  caption: text("caption"),
  dayNumber: integer("day_number"),
  aiAnalysis: text("ai_analysis"),
  takenAt: timestamp("taken_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPhotoSchema = createInsertSchema(photosTable).omit({
  id: true,
  createdAt: true,
});

export const selectPhotoSchema = createSelectSchema(photosTable);

export type InsertPhoto = z.infer<typeof insertPhotoSchema>;
export type Photo = typeof photosTable.$inferSelect;

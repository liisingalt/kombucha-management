import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const personaMaterialsTable = pgTable("persona_materials", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  sourceUrl: text("source_url"),
  type: text("type").notNull().default("manual"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPersonaMaterialSchema = createInsertSchema(personaMaterialsTable).omit({
  id: true,
  createdAt: true,
});

export const selectPersonaMaterialSchema = createSelectSchema(personaMaterialsTable);

export type InsertPersonaMaterial = z.infer<typeof insertPersonaMaterialSchema>;
export type PersonaMaterial = typeof personaMaterialsTable.$inferSelect;

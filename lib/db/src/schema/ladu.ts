import { pgTable, serial, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

export const laduFlavorsTable = pgTable("ladu_flavors", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  defaultCapId: integer("default_cap_id"),
});

export const laduBottlesTable = pgTable("ladu_bottles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  size: integer("size").notNull(),
  qty: integer("qty").notNull().default(0),
});

export const laduLabelsTable = pgTable("ladu_labels", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  flavorId: integer("flavor_id").notNull(),
  size: integer("size").notNull(),
  qty: integer("qty").notNull().default(0),
});

export const laduCapsTable = pgTable("ladu_caps", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  size: integer("size").notNull(),
  type: text("type").notNull().default(""),
  color: text("color").notNull().default(""),
  qty: integer("qty").notNull().default(0),
});

export const laduMovementsTable = pgTable("ladu_movements", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  summary: text("summary").notNull(),
  deltas: jsonb("deltas").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type LaduFlavor = typeof laduFlavorsTable.$inferSelect;
export type LaduBottle = typeof laduBottlesTable.$inferSelect;
export type LaduLabel = typeof laduLabelsTable.$inferSelect;
export type LaduCap = typeof laduCapsTable.$inferSelect;
export type LaduMovement = typeof laduMovementsTable.$inferSelect;

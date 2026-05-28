import { pgTable, serial, text, integer, jsonb, timestamp, real } from "drizzle-orm/pg-core";

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

export const laduCustomLabelBottlesTable = pgTable("ladu_custom_label_bottles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  size: integer("size").notNull(),
  qty: integer("qty").notNull().default(0),
});

export const laduWireCagesTable = pgTable("ladu_wire_cages", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  qty: integer("qty").notNull().default(0),
});

export const laduReusableCapsTable = pgTable("ladu_reusable_caps", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  size: integer("size").notNull(),
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

export const laduBlankLabelTypesTable = pgTable("ladu_blank_label_types", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
});

export const laduBlankLabelsTable = pgTable("ladu_blank_labels", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  blankLabelTypeId: integer("blank_label_type_id").notNull(),
  size: integer("size").notNull(),
  qty: integer("qty").notNull().default(0),
});

export const laduFinishedGoodsTable = pgTable("ladu_finished_goods", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  flavorId: integer("flavor_id").notNull(),
  size: integer("size").notNull(),
  qty: integer("qty").notNull().default(0),
});

export const laduMaterialsTable = pgTable("ladu_materials", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  unit: text("unit").notNull(),
  qty: real("qty").notNull().default(0),
});

export type LaduFlavor = typeof laduFlavorsTable.$inferSelect;
export type LaduBottle = typeof laduBottlesTable.$inferSelect;
export type LaduLabel = typeof laduLabelsTable.$inferSelect;
export type LaduCap = typeof laduCapsTable.$inferSelect;
export type LaduCustomLabelBottle = typeof laduCustomLabelBottlesTable.$inferSelect;
export type LaduWireCage = typeof laduWireCagesTable.$inferSelect;
export type LaduReusableCap = typeof laduReusableCapsTable.$inferSelect;
export type LaduMovement = typeof laduMovementsTable.$inferSelect;
export type LaduBlankLabelType = typeof laduBlankLabelTypesTable.$inferSelect;
export type LaduBlankLabel = typeof laduBlankLabelsTable.$inferSelect;
export type LaduFinishedGoods = typeof laduFinishedGoodsTable.$inferSelect;
export type LaduMaterial = typeof laduMaterialsTable.$inferSelect;

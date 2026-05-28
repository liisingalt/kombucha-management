import { pgTable, serial, text, integer, real, timestamp } from "drizzle-orm/pg-core";

export const teaStockTable = pgTable("tea_stock", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  qtyG: integer("qty_g").notNull().default(0),
});

export const sugarStockTable = pgTable("sugar_stock", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  qtyG: integer("qty_g").notNull().default(0),
});

export const brewsTable = pgTable("brews", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  date: text("date").notNull(),
  boiledL: real("boiled_l").notNull(),
  startBoilTime: text("start_boil_time").default(""),
  tempReachedMin: integer("temp_reached_min"),
  temp: integer("temp"),
  teaStockId: integer("tea_stock_id"),
  teaSort: text("tea_sort").default(""),
  teaG: integer("tea_g").notNull().default(0),
  steepMin: integer("steep_min").default(10),
  steepHeat: integer("steep_heat").default(0),
  sugarStockId: integer("sugar_stock_id"),
  sugarG: integer("sugar_g").notNull().default(0),
  coldWaterL: real("cold_water_l").notNull().default(0),
  coolStartTime: text("cool_start_time").default(""),
  coolPlace: text("cool_place").default(""),
  coolTemp: integer("cool_temp"),
  continuedTime: text("continued_time").default(""),
  notes: text("notes").default(""),
  starterPct: integer("starter_pct").notNull().default(20),
  starterG: integer("starter_g").notNull().default(0),
  electricityKwh: real("electricity_kwh"),
});

export type TeaStock = typeof teaStockTable.$inferSelect;
export type SugarStock = typeof sugarStockTable.$inferSelect;
export type Brew = typeof brewsTable.$inferSelect;

import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bottleTestsTable = pgTable("bottle_tests", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  product: text("product").notNull(),
  bottleId: text("bottle_id").notNull(),
  bottledDate: timestamp("bottled_date").notNull(),
  intervalMonths: integer("interval_months").notNull(),
  nextTasting: timestamp("next_tasting").notNull(),
  status: text("status").notNull().default("ootab"),
  result: text("result"),
  conclusion: text("conclusion"),
  tastedDate: timestamp("tasted_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBottleTestSchema = createInsertSchema(bottleTestsTable).omit({
  id: true,
  createdAt: true,
});

export const selectBottleTestSchema = createSelectSchema(bottleTestsTable);

export type InsertBottleTest = z.infer<typeof insertBottleTestSchema>;
export type BottleTest = typeof bottleTestsTable.$inferSelect;

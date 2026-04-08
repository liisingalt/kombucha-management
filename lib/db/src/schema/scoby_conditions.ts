import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const scobyConditionsTable = pgTable("scoby_conditions", {
  id: serial("id").primaryKey(),
  imageUrl: text("image_url").notNull(),
  isOk: boolean("is_ok").notNull(),
  okReason: text("ok_reason"),
  notOkReason: text("not_ok_reason"),
  whatToDo: text("what_to_do").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ScobyCondition = typeof scobyConditionsTable.$inferSelect;
export type InsertScobyCondition = typeof scobyConditionsTable.$inferInsert;

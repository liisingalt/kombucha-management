import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const profilesTable = pgTable("profiles", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  hasCompletedOnboarding: boolean("has_completed_onboarding").notNull().default(false),
  hasMadeBefore: boolean("has_made_before").notNull().default(false),
  hasScoby: boolean("has_scoby").notNull().default(false),
  currentStage: text("current_stage"),
  experienceLevel: text("experience_level"),
  flavorPreference: text("flavor_preference"),
  onboardingAdvice: text("onboarding_advice"),
  ttsEnabled: boolean("tts_enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProfileSchema = createInsertSchema(profilesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectProfileSchema = createSelectSchema(profilesTable);

export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profilesTable.$inferSelect;

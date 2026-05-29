CREATE TABLE "profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text NOT NULL,
	"has_completed_onboarding" boolean DEFAULT false NOT NULL,
	"has_made_before" boolean DEFAULT false NOT NULL,
	"has_scoby" boolean DEFAULT false NOT NULL,
	"current_stage" text,
	"experience_level" text,
	"flavor_preference" text,
	"onboarding_advice" text,
	"tts_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"tea_type" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_id" integer NOT NULL,
	"day_number" integer NOT NULL,
	"temperature" real,
	"scobylook" text,
	"smell" text,
	"color" text,
	"notes" text,
	"ai_tip" text,
	"taste" text[],
	"carbonation" text,
	"ph" real,
	"activities" text[],
	"flavour_additions" text[],
	"logged_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_id" integer NOT NULL,
	"object_path" text NOT NULL,
	"caption" text,
	"day_number" integer,
	"ai_analysis" text,
	"taken_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persona_materials" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"source_url" text,
	"type" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scoby_conditions" (
	"id" serial PRIMARY KEY NOT NULL,
	"image_url" text NOT NULL,
	"is_ok" boolean NOT NULL,
	"ok_reason" text,
	"not_ok_reason" text,
	"what_to_do" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "logs" ADD CONSTRAINT "logs_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;
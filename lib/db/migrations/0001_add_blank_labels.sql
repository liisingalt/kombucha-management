CREATE TABLE "ladu_blank_label_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ladu_blank_labels" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"blank_label_type_id" integer NOT NULL,
	"size" integer NOT NULL,
	"qty" integer DEFAULT 0 NOT NULL
);

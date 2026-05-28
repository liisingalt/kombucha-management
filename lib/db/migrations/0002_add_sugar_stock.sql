CREATE TABLE "sugar_stock" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" text NOT NULL,
        "name" text NOT NULL,
        "qty_g" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brews" ADD COLUMN "sugar_stock_id" integer;

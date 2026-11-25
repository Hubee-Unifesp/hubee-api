ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "photo_url" varchar(2048);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "title_color" varchar(7);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "description_color" varchar(7);
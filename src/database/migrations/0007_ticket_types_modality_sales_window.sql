DO $$ BEGIN
 CREATE TYPE "public"."ticket_type_modality" AS ENUM('inteira', 'meia', 'estudante', 'vip', 'cortesia');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "ticket_types" ADD COLUMN IF NOT EXISTS "modality" "ticket_type_modality" DEFAULT 'inteira' NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_types" ADD COLUMN IF NOT EXISTS "sales_start_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ticket_types" ADD COLUMN IF NOT EXISTS "sales_end_date" timestamp with time zone;

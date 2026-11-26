DO $$ BEGIN
 CREATE TYPE "public"."expense_group" AS ENUM('fixed', 'variable', 'marketing');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "fornecedor_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "due_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "group" "expense_group" DEFAULT 'fixed' NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "group" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "category" varchar(100);--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (
   SELECT 1 FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'cost_type'
 ) THEN
   UPDATE "expenses" SET "category" = "cost_type" WHERE "category" IS NULL;
   ALTER TABLE "expenses" DROP COLUMN "cost_type";
 END IF;
END $$;--> statement-breakpoint
UPDATE "expenses" SET "category" = 'Outros' WHERE "category" IS NULL;--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "category" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "quantity" numeric(12, 2) DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "unit_price" numeric(12, 2);--> statement-breakpoint
UPDATE "expenses" SET "unit_price" = "amount" WHERE "unit_price" IS NULL;--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "unit_price" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "responsible" varchar(255);--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "quoted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "notes" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_quantity_non_negative" CHECK ("expenses"."quantity" >= 0);
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_unit_price_non_negative" CHECK ("expenses"."unit_price" >= 0);
EXCEPTION WHEN duplicate_object THEN null;
END $$;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "expected_audience" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_expected_audience_positive" CHECK ("events"."expected_audience" > 0);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

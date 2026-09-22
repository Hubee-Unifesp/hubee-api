CREATE TYPE "public"."organization_event_role" AS ENUM('main', 'co_organizer', 'supporter');--> statement-breakpoint
CREATE TABLE "organization_events" (
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"role" "organization_event_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_events_organization_id_event_id_pk" PRIMARY KEY("organization_id","event_id")
);
--> statement-breakpoint
ALTER TABLE "organization_events" ADD CONSTRAINT "organization_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_events" ADD CONSTRAINT "organization_events_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organization_events_event_id_idx" ON "organization_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "organization_events_organization_id_idx" ON "organization_events" USING btree ("organization_id");
CREATE TYPE "public"."order_status" AS ENUM('pendente', 'pago', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."event_age_rating" AS ENUM('L', '10', '12', '14', '16', '18');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('draft', 'published', 'finished', 'cancelled');--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "order_status" DEFAULT 'pendente' NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_total_amount_non_negative" CHECK ("orders"."total_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"age_rating" "event_age_rating",
	"organizer_id" uuid NOT NULL,
	"venue_id" uuid NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"sales_start_date" timestamp with time zone,
	"status" "event_status" DEFAULT 'draft' NOT NULL,
	"category" varchar(100),
	"edition" varchar(100),
	"photo_url" varchar(2048),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_end_after_start" CHECK ("events"."end_date" > "events"."start_date"),
	CONSTRAINT "events_sales_start_before_event" CHECK ("events"."sales_start_date" <= "events"."start_date")
);
--> statement-breakpoint
CREATE TABLE "organization_users" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(20) NOT NULL,
	"permission" varchar(20) NOT NULL,
	"invite_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "organization_users_organization_id_user_id_pk" PRIMARY KEY("organization_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "suppliers" RENAME COLUMN "name" TO "company_name";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_email_unique";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_cpf_unique";--> statement-breakpoint
ALTER TABLE "suppliers" DROP CONSTRAINT "suppliers_cnpj_cpf_unique";--> statement-breakpoint
ALTER TABLE "suppliers" DROP CONSTRAINT "suppliers_email_unique";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';--> statement-breakpoint
ALTER TABLE "suppliers" ALTER COLUMN "created_at" SET DATA TYPE timestamp;--> statement-breakpoint
ALTER TABLE "suppliers" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "suppliers" ALTER COLUMN "updated_at" SET DATA TYPE timestamp;--> statement-breakpoint
ALTER TABLE "suppliers" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organizer_id_organizations_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email") WHERE "users"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "users_cpf_unique" ON "users" USING btree ("cpf") WHERE "users"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_cnpj_cpf_unique" ON "suppliers" USING btree ("cnpj_cpf") WHERE "suppliers"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_email_unique" ON "suppliers" USING btree ("email") WHERE "suppliers"."deleted_at" is null;--> statement-breakpoint
ALTER TABLE "suppliers" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "company_name";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "cnpj_cpf";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "phone";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "email";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "category";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "deleted_at";
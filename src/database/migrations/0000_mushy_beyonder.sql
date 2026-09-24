CREATE TYPE "public"."order_status" AS ENUM('pendente', 'pago', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."event_age_rating" AS ENUM('L', '10', '12', '14', '16', '18');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('draft', 'published', 'finished', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('pending', 'in_progress', 'done');--> statement-breakpoint
CREATE TYPE "public"."organization_event_role" AS ENUM('main', 'co_organizer', 'supporter');--> statement-breakpoint
CREATE TYPE "public"."despesa_payment_status" AS ENUM('pendente', 'pago', 'atrasado', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."pagamento_metodo" AS ENUM('cartao_credito', 'cartao_debito', 'pix', 'boleto', 'transferencia');--> statement-breakpoint
CREATE TYPE "public"."pagamento_status" AS ENUM('pendente', 'confirmado', 'recusado', 'estornado');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(20),
	"password" varchar(255) NOT NULL,
	"cpf" varchar(11) NOT NULL,
	"birth_date" date NOT NULL,
	"profile_type" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'ACTIVE',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp
);
--> statement-breakpoint
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
	"featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_end_after_start" CHECK ("events"."end_date" > "events"."start_date"),
	CONSTRAINT "events_sales_start_before_event" CHECK ("events"."sales_start_date" <= "events"."start_date")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"responsible_user_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"due_date" timestamp with time zone,
	"status" "task_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"zip_code" varchar(9) NOT NULL,
	"street" varchar(255) NOT NULL,
	"number" varchar(20) NOT NULL,
	"complement" varchar(255),
	"neighborhood" varchar(100) NOT NULL,
	"city" varchar(100) NOT NULL,
	"state" varchar(2) NOT NULL,
	"country" varchar(100) DEFAULT 'Brasil' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"max_capacity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venues_max_capacity_positive" CHECK ("venues"."max_capacity" > 0)
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
CREATE TABLE "organization_events" (
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"role" "organization_event_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_events_organization_id_event_id_pk" PRIMARY KEY("organization_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"cnpj_cpf" varchar(20) NOT NULL,
	"phone" varchar(20),
	"email" varchar(255),
	"category" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"representative_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"fornecedor_id" uuid NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"cost_type" varchar(100) NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"payment_status" "despesa_payment_status" DEFAULT 'pendente' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_amount_non_negative" CHECK ("expenses"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "pagamentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"metodo_pagamento" "pagamento_metodo" NOT NULL,
	"status" "pagamento_status" DEFAULT 'pendente' NOT NULL,
	"valor_pago" numeric(12, 2) NOT NULL,
	"data_pagamento" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pagamentos_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "pagamentos_valor_pago_non_negative" CHECK ("pagamentos"."valor_pago" >= 0)
);
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organizer_id_organizations_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_responsible_user_id_users_id_fk" FOREIGN KEY ("responsible_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_address_id_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."addresses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_events" ADD CONSTRAINT "organization_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_events" ADD CONSTRAINT "organization_events_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_representative_id_users_id_fk" FOREIGN KEY ("representative_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_fornecedor_id_suppliers_id_fk" FOREIGN KEY ("fornecedor_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email") WHERE "users"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "users_cpf_unique" ON "users" USING btree ("cpf") WHERE "users"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "tasks_event_id_idx" ON "tasks" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "tasks_responsible_user_id_idx" ON "tasks" USING btree ("responsible_user_id");--> statement-breakpoint
CREATE INDEX "organization_events_event_id_idx" ON "organization_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "organization_events_organization_id_idx" ON "organization_events" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_cnpj_cpf_unique" ON "suppliers" USING btree ("cnpj_cpf") WHERE "suppliers"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_email_unique" ON "suppliers" USING btree ("email") WHERE "suppliers"."deleted_at" is null;
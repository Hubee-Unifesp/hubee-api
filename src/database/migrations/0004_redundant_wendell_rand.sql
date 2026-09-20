CREATE TYPE "public"."despesa_payment_status" AS ENUM('pendente', 'pago', 'atrasado', 'cancelado');--> statement-breakpoint
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
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_fornecedor_id_suppliers_id_fk" FOREIGN KEY ("fornecedor_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;
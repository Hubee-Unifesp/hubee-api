CREATE TABLE IF NOT EXISTS "expense_installments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expense_id" uuid NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"status" "despesa_payment_status" DEFAULT 'pendente' NOT NULL,
	"paid_by" varchar(255),
	"payment_method" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_installments_amount_positive" CHECK ("expense_installments"."amount" > 0)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expense_installments" ADD CONSTRAINT "expense_installments_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expense_installments_expense_id_idx" ON "expense_installments" USING btree ("expense_id");

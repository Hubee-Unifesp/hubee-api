CREATE TABLE IF NOT EXISTS "supplier_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"comment" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_reviews_rating_range" CHECK ("supplier_reviews"."rating" >= 1 and "supplier_reviews"."rating" <= 5)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "supplier_reviews" ADD CONSTRAINT "supplier_reviews_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "supplier_reviews" ADD CONSTRAINT "supplier_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "supplier_reviews_supplier_id_user_id_unique" ON "supplier_reviews" USING btree ("supplier_id","user_id");

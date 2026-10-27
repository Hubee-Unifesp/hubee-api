ALTER TABLE "ticket_types" DROP CONSTRAINT "ticket_types_price_positive";--> statement-breakpoint
ALTER TABLE "ticket_types" ADD COLUMN "quantity" numeric(10, 0) NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_types" ADD CONSTRAINT "ticket_types_price_positive" CHECK ("ticket_types"."price" >= 0);
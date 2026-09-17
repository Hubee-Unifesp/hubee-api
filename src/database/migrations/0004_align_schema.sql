UPDATE "users" SET "status" = 'ACTIVE' WHERE "status" = 'ATIVO';--> statement-breakpoint
UPDATE "organization_users" SET "invite_status" = 'pending' WHERE "invite_status" = 'pendente';--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_email_unique";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_cpf_unique";--> statement-breakpoint
ALTER TABLE "suppliers" DROP CONSTRAINT "suppliers_cnpj_cpf_unique";--> statement-breakpoint
ALTER TABLE "suppliers" DROP CONSTRAINT "suppliers_email_unique";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';--> statement-breakpoint
ALTER TABLE "organization_users" ALTER COLUMN "invite_status" SET DEFAULT 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email") WHERE "users"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "users_cpf_unique" ON "users" USING btree ("cpf") WHERE "users"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_cnpj_cpf_unique" ON "suppliers" USING btree ("cnpj_cpf") WHERE "suppliers"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_email_unique" ON "suppliers" USING btree ("email") WHERE "suppliers"."deleted_at" is null;

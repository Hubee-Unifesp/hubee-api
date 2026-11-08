-- Idempotente (GOL-213): bancos criados via db:push ou com migrations aplicadas
-- à mão já podem ter full_name/role; cada passo só roda se ainda for necessário.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "full_name" varchar(200);
--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'first_name') THEN
  EXECUTE 'UPDATE "users" SET "full_name" = concat_ws('' '', trim("first_name"), trim("last_name")) WHERE "full_name" IS NULL';
 END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "full_name" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "first_name";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "last_name";
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "cpf" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "birth_date" DROP NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'profile_type')
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role') THEN
  ALTER TABLE "users" RENAME COLUMN "profile_type" TO "role";
 END IF;
END $$;
--> statement-breakpoint
-- Preserve existing administrators; legacy profile values become ordinary users.
UPDATE "users" SET "role" = CASE WHEN "role" = 'ADMIN' THEN 'ADMIN' ELSE 'USER' END WHERE "role" IS DISTINCT FROM 'ADMIN' AND "role" IS DISTINCT FROM 'USER';
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" TYPE varchar(20);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'USER';
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "signup_intent" varchar(20);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("role" in ('USER', 'ADMIN'));
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_signup_intent_check" CHECK ("signup_intent" in ('BUY', 'ORGANIZE'));
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "users" ADD COLUMN "full_name" varchar(200);
--> statement-breakpoint
UPDATE "users" SET "full_name" = concat_ws(' ', trim("first_name"), trim("last_name"));
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "full_name" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "first_name";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "last_name";
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "cpf" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "birth_date" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "profile_type" TO "role";
--> statement-breakpoint
-- Preserve existing administrators; legacy profile values become ordinary users.
UPDATE "users" SET "role" = CASE WHEN "role" = 'ADMIN' THEN 'ADMIN' ELSE 'USER' END;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" TYPE varchar(20);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'USER';
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "signup_intent" varchar(20);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("role" in ('USER', 'ADMIN'));
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_signup_intent_check" CHECK ("signup_intent" in ('BUY', 'ORGANIZE'));

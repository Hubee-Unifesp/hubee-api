-- O schema passou a usar integer com default 0 (GOL-111) sem gerar migration;
-- o drizzle-kit emite só a troca de tipo, então o default foi adicionado à mão.
ALTER TABLE "ticket_types" ALTER COLUMN "quantity" SET DATA TYPE integer USING "quantity"::integer;
--> statement-breakpoint
ALTER TABLE "ticket_types" ALTER COLUMN "quantity" SET DEFAULT 0;

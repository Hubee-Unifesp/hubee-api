CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"cnpj_cpf" varchar(20) NOT NULL,
	"phone" varchar(20),
	"email" varchar(255),
	"category" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "suppliers_cnpj_cpf_unique" UNIQUE("cnpj_cpf"),
	CONSTRAINT "suppliers_email_unique" UNIQUE("email")
);

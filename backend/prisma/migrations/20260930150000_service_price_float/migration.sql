-- Altera services.price de DECIMAL para DOUBLE PRECISION.
-- O Decimal do Prisma é serializado como string no JSON ("35"), o que quebrava
-- toFixed()/soma no frontend. Float serializa como number.
ALTER TABLE "services"
  ALTER COLUMN "price" TYPE DOUBLE PRECISION USING "price"::double precision;

ALTER TABLE "services"
  ALTER COLUMN "price" SET DEFAULT 0;

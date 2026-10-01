-- birthDate passa a ser anulável: um telefone pode ter o cadastro iniciado
-- (verificado por WhatsApp) sem ainda ter informado a data de nascimento.
-- A aplicação trata null como "cadastro incompleto" e o job de aniversário
-- já ignora quem é null.
ALTER TABLE "clients" ALTER COLUMN "birthDate" DROP NOT NULL;
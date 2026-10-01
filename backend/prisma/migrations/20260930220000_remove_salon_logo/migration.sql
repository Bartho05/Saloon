-- Remove a coluna logoUrl: o usuário pediu para dispensar o logo do salão.
-- A foto dos funcionários (users.photoUrl) continua — ela é usada no
-- agendamento público para o cliente ver com quem vai.
ALTER TABLE "salon_settings" DROP COLUMN IF EXISTS "logoUrl";
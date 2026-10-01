-- Adiciona caminhos de imagem (upload em disco, servido por express.static)
ALTER TABLE "salon_settings" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "salon_settings" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;

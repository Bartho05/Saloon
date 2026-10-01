-- administered — códigos de verificação no banco
--
-- Antes isto era um `Map` na memória do processo. Em desenvolvimento funcionava;
-- em serverless quebraria de um jeito que só apareceria depois do deploy: cada
-- instância tem memória própria, então o pedido do código podia cair na
-- instância A e a verificação na B, e o cliente receberia um código que o
-- sistema "não conhecia".
CREATE TABLE "verification_codes" (
    "id"        TEXT         NOT NULL,
    "phone"     TEXT         NOT NULL,
    "codeHash"  TEXT         NOT NULL,
    "attempts"  INTEGER      NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

-- Toda verificação busca por telefone e descarta o que já expirou. Um índice
-- só em `phone` obrigaria a varrer também os códigos velhos.
CREATE INDEX "verification_codes_phone_expires_at_idx" ON "verification_codes"("phone", "expiresAt");

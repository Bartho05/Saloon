-- administered — acesso de nível máximo à instalação
--
-- `code_hash` guarda scrypt(código + salt + pepper), não o código. Não existe
-- função neste projeto que transforme o hash de volta no código, e é essa a
-- propriedade que importa: mesmo com o banco inteiro em mãos, o código não sai
-- dali.
--
-- `code_fingerprint` identifica o código para o operador sem ajudar a
-- recuperá-lo. `code_salt` é por conta, o que impede que dois códigos iguais
-- gerem hashes iguais e que uma tabela pré-computada ataque todos de uma vez.
--
-- Nome das colunas em camelCase, igual às demais tabelas do projeto (`users`
-- usa `passwordHash`, `isActive`): o schema do Prisma não tem @map nos campos,
-- então o nome no banco precisa ser o mesmo do campo.
CREATE TABLE "super_admins" (
    "id"               SERIAL       NOT NULL,
    "name"             TEXT         NOT NULL,
    "email"            TEXT         NOT NULL,
    "codeHash"         TEXT         NOT NULL,
    "codeSalt"         TEXT         NOT NULL,
    "codeFingerprint"  TEXT         NOT NULL,
    "codeCreatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "codeRotatedAt"    TIMESTAMP(3),
    "isActive"         BOOLEAN      NOT NULL DEFAULT true,
    "lastLoginAt"      TIMESTAMP(3),
    "failedAttempts"   INTEGER      NOT NULL DEFAULT 0,
    "lockedUntil"      TIMESTAMP(3),
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "super_admins_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "super_admin_audit" (
    "id"              SERIAL       NOT NULL,
    "superAdminId"    INTEGER,
    "action"          TEXT         NOT NULL,
    "ip"              TEXT,
    "userAgent"       TEXT,
    "detail"          TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "super_admin_audit_pkey" PRIMARY KEY ("id")
);

-- E-mail é a identidade de quem entra, e é o que o operador digita para
-- localizar a conta: precisa ser único.
CREATE UNIQUE INDEX "super_admins_email_key" ON "super_admins"("email");

CREATE INDEX "super_admin_audit_action_created_at_idx" ON "super_admin_audit"("action", "createdAt");

CREATE INDEX "super_admin_audit_super_admin_id_created_at_idx" ON "super_admin_audit"("superAdminId", "createdAt");

ALTER TABLE "super_admin_audit" ADD CONSTRAINT "super_admin_audit_super_admin_id_fkey" FOREIGN KEY ("superAdminId") REFERENCES "super_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Última entrada ao painel de dono. É a informação que permite ao superadmin
-- notar um cadastro que nunca foi usado, e ao próprio dono saber se a conta
-- está em uso.
ALTER TABLE "users" ADD COLUMN "lastLoginAt" TIMESTAMP(3);

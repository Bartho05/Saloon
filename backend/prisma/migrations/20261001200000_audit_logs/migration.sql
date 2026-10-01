-- administered — auditoria de tudo, em uma tabela só
--
-- Substitui `super_admin_audit`. A tabela antiga guardava so o acesso maximo;
-- esta guarda toda ação do sistema, distinguida por `actorKind` e `action`.
-- Uma tabela só porque duas fariam a pergunta "qual eu olho?" sem resposta
-- única — e o log do superadmin é só um `actorKind = 'SUPERADMIN'` aqui.
--
-- Sem chave estrangeira para o autor, de propósito: o log sobrevive à conta.
-- Se alguém apaga o próprio acesso e sai, o rastro é o que sobra.
CREATE TABLE "audit_logs" (
    "id"          SERIAL       NOT NULL,
    "action"      TEXT         NOT NULL,
    "entity"      TEXT,
    "entityId"    TEXT,
    "outcome"     TEXT         NOT NULL DEFAULT 'SUCCESS',
    "actorKind"   TEXT         NOT NULL,
    "actorId"     TEXT,
    "actorLabel"  TEXT,
    "summary"     TEXT         NOT NULL,
    "metadata"    JSONB,
    "ip"          TEXT,
    "userAgent"   TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- "O que aconteceu mais recentemente" e "o que aconteceu com ESTE
-- agendamento" são as duas perguntas que se faz de um log. Os demais índices
-- são para filtro por ação e por autor.
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("createdAt");

CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "createdAt");

CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entityId");

CREATE INDEX "audit_logs_actor_kind_actor_id_idx" ON "audit_logs"("actorKind", "actorId");

CREATE INDEX "audit_logs_outcome_created_at_idx" ON "audit_logs"("outcome", "createdAt");

-- Migra o histórico do superadmin em vez de apagá-lo. Os textos antigos viram
-- `summary` e a vira de detalhe vai para `metadata`, para que um registro de
-- antes continue legível na tela nova.
INSERT INTO "audit_logs"
    ("action", "entity", "entityId", "outcome", "actorKind", "actorId", "actorLabel",
     "summary", "metadata", "ip", "userAgent", "createdAt")
SELECT
    -- Os nomes das ações também mudaram com a tabela. Migrar o texto do
    -- `summary` sem o código deixaria linhas antigas com rótulo "LOGIN_SUCCESS"
    -- na tela, ao lado de "LOGIN" das novas — e a pessoa teria duas
    -- representações do mesmo evento.
    CASE "action"
        WHEN 'LOGIN_SUCCESS' THEN 'LOGIN'
        WHEN 'LOCKED'        THEN 'ACCOUNT_LOCKED'
        WHEN 'UNLOCK'        THEN 'SUPERADMIN_UNLOCKED'
        WHEN 'ROTATE_CODE'   THEN 'SUPERADMIN_CODE_ROTATED'
        WHEN 'ACTIVATE'      THEN 'SUPERADMIN_ACTIVATED'
        WHEN 'DEACTIVATE'    THEN 'SUPERADMIN_DEACTIVATED'
        WHEN 'CREATE_OWNER'  THEN 'OWNER_CREATED'
        WHEN 'CREATE_OWNER_DENIED' THEN 'OWNER_CREATION_DENIED'
        ELSE "action"
    END,
    'superadmin',
    "superAdminId"::text,
    -- A tabela antiga não distinguia sucesso de falha. As recusas (bootstrap e
    -- login errado) são falha por definição; o resto, sucesso.
    CASE "action"
        WHEN 'BOOTSTRAP_DENIED' THEN 'FAILURE'
        WHEN 'LOGIN_FAILED'     THEN 'FAILURE'
        WHEN 'CREATE_OWNER_DENIED' THEN 'FAILURE'
        ELSE 'SUCCESS'
    END,
    'SUPERADMIN',
    "superAdminId"::text,
    NULL,
    -- `detail` era o texto livre da nota antiga. Virava a descrição; quando
    -- não havia nada, a frase padrão descreve o evento pelo código.
    CASE
        WHEN "action" = 'BOOTSTRAP'
            THEN 'Primeiro acesso criado'
        WHEN "action" = 'BOOTSTRAP_DENIED'
            THEN 'Instalação recusada'
        WHEN "action" = 'LOGIN_SUCCESS'
            THEN 'Entrou no painel administrativo'
        WHEN "action" = 'LOGIN_FAILED'
            THEN 'Não conseguiu entrar'
        WHEN "action" = 'LOCKED'
            THEN 'Conta travada por excesso de tentativas'
        WHEN "action" = 'UNLOCK'
            THEN 'Conta destravada'
        WHEN "action" = 'ROTATE_CODE'
            THEN 'Código de acesso trocado'
        WHEN "action" = 'CREATE_OWNER'
            THEN 'Proprietário criado'
        WHEN "action" = 'CREATE_OWNER_DENIED'
            THEN 'Criação de proprietário recusada'
        WHEN "action" = 'ACTIVATE'
            THEN 'Conta reativada'
        WHEN "action" = 'DEACTIVATE'
            THEN 'Conta desativada'
        ELSE COALESCE(NULLIF("detail", ''), "action")
    END,
    -- O texto antigo vai como metadado, e não some: às vezes ele é o único
    -- registro do motivo exato (a hora em que a conta destravou, por exemplo).
    CASE
        WHEN "detail" IS NULL OR "detail" = '' THEN NULL
        ELSE jsonb_build_object('notaAntiga', "detail")
    END,
    "ip",
    "userAgent",
    "createdAt"
FROM "super_admin_audit";

DROP TABLE "super_admin_audit";

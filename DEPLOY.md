# Guia de deploy

Este guia cobre o que você precisa saber para colocar o sistema no ar. A
ordem importa: há três decisões de arquitetura que, se forem tomadas na ordem
errada, descobertas tarde.

---

## 1. Como o banco de dados funciona

### 1.1 O que é

Postgres, gerenciado pelo Supabase. Você não instala nada: o Supabase é um
Postgres na nuvem, com painel web, backup e uma interface para olhar as
tabelas.

O acesso é por uma URL, guardada em `DATABASE_URL`:

```
postgresql://postgres.REFERENCIA:SENHA@db.REFERENCIA.supabase.co:5432/postgres
```

- `REFERENCIA` e a `SENHA` estão em **Project Settings > Database**.
- A porta **5432** é a conexão direta. Existe também a 6543, o *pooler* — e
  o motivo de não usá-la está em 1.3.

### 1.2 Schemas: dois bancos no mesmo servidor

O Postgres separa conjuntos de tabelas por *schema*. Aqui existem dois:

| Schema | Para que serve | Pode ser apagado |
|---|---|---|
| `public` | o sistema de verdade | **NÃO** |
| `test` | os testes automatizados | sim, a qualquer momento |

O `schema=test` não é um banco à parte: é o mesmo servidor, com tabelas
separadas e o mesmo login. A distinção aparece na URL:

```
?schema=public     -> desenvolvimento e produção
?schema=test       -> suíte de testes
```

**Por que isso importa:** os testes rodam `deleteMany` em serviços, clientes,
agendamentos e funcionários antes de cada caso. Se apontassem para `public`,
zerariam o salão inteiro — e foi exatamente o que aconteceu uma vez durante o
desenvolvimento deste projeto.

Para que isso não se repita, `src/tests/setup.ts` **recusa a execução** se a
URL não tiver `schema=test`. É uma trava que quebra o build, não um aviso.

### 1.3 Conexões: por que 5432 e não 6543

O Supabase tem dois caminhos:

- **5432 (direta)** — uma conexão TCP por instância. Prepared statements
  ativos, mais rápido.
- **6543 (PgBouncer, transacional)** — multiplexa muitas requisições sobre
  poucas conexões. Economiza conexões, mas **desliga prepared statements**.

O Prisma depende de prepared statements. Apontar para a 6543 "para economizar"
troca um problema de limite de conexões por um de lentidão e erro
intermitente. Para um sistema de salão, a conexão direta está certa.

O pool fica pequeno de propósito: `connection_limit=5` no `database.ts`.

### 1.4 Migrations: o que é e quando roda

Migration é o histórico de mudanças do formato do banco. Cada arquivo em
`backend/prisma/migrations/` é um passo:

```
20261001120000_client_birthdate_nullable
20261001180000_superadmin
20261001200000_audit_logs
20261001210000_verification_codes
```

Aplicar todas, na ordem:

```bash
npx prisma migrate deploy
```

Regra que importa: **em produção, rode sempre `migrate deploy`**, nunca
`migrate dev`. O `dev` cria migration nova a partir da diferença entre o
schema e o banco, e em produção ele tentaria mudar o banco para coincidir com
uma máquina local.

Onde rodar no deploy: antes de subir a aplicação, ou como passo de build. Uma
migration de tabela nova roda rápido; rotacionar uma coluna grande pode
demorar, e aí vale separar.

### 1.5 Prisma: a ponte

O Prisma é a camada entre o código e o Postgres. O schema dele está em
`backend/prisma/schema.prisma`, e o código fala com o banco através dos
objetos gerados:

```ts
// o código nunca escreve SQL
const clientes = await prisma.client.findMany({ where: { phone } });

// e o SQL sai disto:
// SELECT "public"."Client"."id", ... WHERE phone = $1
```

O que isso te dá: tipos garantidos pelo compilador, uma consulta por vez (sem
SQL injection por construção) e uma mudança de banco que não exige reescrever
consultas.

### 1.6 Backup

O Supabase faz backup automático diário, com 7 dias de retenção no plano
gratuito. Para reagir a um engano seu — "apaguei o serviço errado" — isso basta:
**Settings > Database > Backups > Restore**, ou o botão de point-in-time.

Para levar os dados para outro lugar, o caminho é
`supabase db dump`. Guarde o `.sql` num lugar fora do Git.

---

## 2. Arquitetura de deploy: o ponto que decide tudo

Você quer o site no Vercel. Ele pode ir. **O backend, com o código como está,
não.**

O motivo é um só, e ele vale para qualquer hospedagem serverless (Vercel,
Netlify Functions, Cloudflare Workers em modo compatibilidade, AWS Lambda):

> **Função serverless não tem disco.**

A foto do profissional é gravada pelo `multer`, num arquivo. Em desenvolvimento
funciona. Em serverless, o arquivo some assim que a função responde — e como o
`/tmp` é por instância, uma foto enviada para a instância A não existe para a
instância B, que pode ser a que atender a próxima requisição.

O sintoma é o pior possível: **nenhum erro**. A tela diz "enviado com
sucesso", a URL é gravada no banco, e a imagem aparece quebrada para todo
mundo.

Por isso o `imageStorage.ts` decide entre dois destinos:

| | Onde guarda | Quando |
|---|---|---|
| Disco local | `backend/uploads/` | desenvolvimento |
| Supabase Storage | bucket `salao-imagens` | produção, com as 3 variáveis preenchidas |

Com as três variáveis de imagem preenchidas, o resto do código não muda nada.
É a mesma chamada, a mesma URL na tela.

### 2.1 As três opções

Escolha uma. A ordem é de recomendação.

**Opção A — backend em um servidor com disco (Recomendado)**

O frontend no Vercel, o backend em qualquer lugar com Node e disco: uma VPS
de R$30/mês, Railway, Render, Fly.io. Aí nada precisa ser reescrito, o cron
funciona, e você tem logs de verdade.

- Vantagem: o sistema funciona como foi escrito.
- Desvantagem: o backend não herda a escalabilidade do Vercel.

**Opção B — tudo no Vercel, backend como função**

O Express vira uma Serverless Function, e as imagens vão para o Supabase
Storage. O código está preparado para isto — o upload já vai para memória,
sem arquivo temporário.

- Vantagem: um lugar só.
- Desvantagem: exige o `api/index.ts` que adapta o Express, `maxDuration`,
  e atenção ao limite de conexões (cada instância tem o próprio pool).

**Opção C — tudo local, sem Vercel**

Rodar na sua máquina com `localhost` exposto por um túnel. Serve para testar
com o celular real, não para produção.

### 2.2 Qual escolher para o seu caso

Para um salão, a **Opção A**. O tráfego de um salão não justifica a
complexidade de serverless, e o cron do Vercel tem limite de frequência no
plano gratuito que pode não servir se você quiser lembretes em horário
comercial.

---

## 3. Os três bloqueadores que quebram o deploy

Estes três já foram resolvidos no código. O ponto é você saber o que conferir,
porque um deles falha **sem mensagem de erro**.

### 3.1 Imagens no disco

**Sintoma se quebrar:** foto "enviada", depois aparece quebrada.

**Como conferir:** preencha `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e
`SUPABASE_STORAGE_BUCKET`. Crie o bucket como **público** — senão a URL
responde 403 e a imagem não carrega, o que parece outro problema.

### 3.2 Códigos de verificação em memória

A primeira versão guardava os códigos de verificação do cliente num `Map` da
memória do Node. Em desenvolvimento: perfeito. Em serverless: o
`POST /request-code` pode cair na instância A e o `POST /verify-code` na B, e
o cliente recebe um código que o sistema "não conhece".

Sintoma: o cliente recebe o código, digita, e o sistema diz que está inválido —
de forma intermitente, sem padrão.

**Já corrigido:** os códigos agora estão na tabela `verification_codes`, com
hash SHA-256, validade de 10 minutos, uso único e 5 tentativas.

### 3.3 Rotinas que não rodam em serverless

`node-cron` roda dentro do processo. Uma função serverless é congelada logo
depois de responder, e o timer dela nunca chega a disparar.

Sintoma: **o sistema funciona normalmente e os lembretes param de
silenciar.** Ninguém percebe até um cliente perguntar se iam ser avisados.

**Já corrigido:** existem três rotas que alguém precisa chamar de fora, com a
chave no header:

```
GET /api/cron/aniversarios
GET /api/cron/lembretes
GET /api/cron/limpeza
```

Configure no `vercel.json` ou em qualquer agendador externo. Veja 5.3.

---

## 4. O que fazer no Vercel (Opção B)

### 4.1 O frontend

1. Importe o repositório no Vercel.
2. **Root Directory:** `frontend`
3. **Framework Preset:** Vite
4. **Build Command:** `npm run build`
5. **Output Directory:** `dist`
6. Variável de ambiente: `VITE_API_URL` com a URL do seu backend.
   (`VITE_` é o prefixo que o Vite expõe ao navegador. Tudo que não tiver
   esse prefixo fica no servidor — é o que protege os segredos.)

### 4.2 O backend

Você precisa do adaptador serverless. Salve como `backend/api/index.ts`:

```ts
import app from '../src/app';

export default app;
```

E o `vercel.json`, na raiz do backend:

```json
{
  "functions": {
    "api/index.ts": { "maxDuration": 30 }
  }
}
```

`maxDuration` acima do padrão: o envio de mensagem do WhatsApp espera resposta
da Z-API, e o limite padrão corta no meio.

### 4.3 O que o Vercel NÃO faz sozinho

- **Rodar migrations.** Configure como passo de build, ou rode uma vez na mão.
- **Guardar imagem.** Precisa do Supabase Storage (3.1).
- **Rodar cron.** Precisa do `vercel.json` (5.3).
- **Ter log de verdade.** O Vercel guarda log de função por tempo limitado.
  Se você quiser histórico, a tabela `audit_logs` é o seu log — e é por isso
  que ela registra tudo, inclusive o que ninguém mais registra.

---

## 5. Passo a passo para subir

### 5.1 Banco

1. Crie o projeto no Supabase.
2. **Settings > Database** → copie a URI (porta **5432**).
3. No terminal:
   ```bash
   cd backend
   # ajuste DATABASE_URL no .env
   npx prisma migrate deploy
   npx prisma generate
   ```
4. Crie o bucket `salao-imagens` em **Storage**, marque como público.

### 5.2 Backend

1. Copie `.env.example` para `.env` e preencha.
2. Teste localmente com `NODE_ENV=production` — é assim que a configuração de
   produção se prova.
3. Suba.

### 5.3 Rotinas

No Vercel, `vercel.json` na raiz do projeto:

```json
{
  "crons": [
    { "path": "/api/cron/aniversarios", "schedule": "0 12 * * *" },
    { "path": "/api/cron/lembretes",   "schedule": "0 13 * * *" },
    { "path": "/api/cron/limpeza",     "schedule": "0 6 * * *" }
  ]
}
```

O horário é **UTC**. As 9h de São Paulo são 12h UTC no horário de verão e
13h UTC fora dele — por isso um horário fixo em UTC desloca uma hora duas
vezes por ano. Se isso incomodar, use um agendador externo com fuso.

O Vercel injeta `CRON_SECRET` sozinho, se a variável de ambiente tiver esse
nome exato.

### 5.4 Primeiro acesso

O sistema nasce sem dono. A ordem é:

1. Crie o superadmin em `/superadmin` (ele pede a semente do `.env`).
2. Entre em **Proprietários** e crie o dono. Isso destrava o sistema: sem
   dono, não existe quem cadastre serviço nem quem abra o painel.
3. Remova `SUPERADMIN_BOOTSTRAP_SEED` do `.env`. A porta fecha de vez.

### 5.5 WhatsApp

Em **Configurações > WhatsApp**, no painel do dono:

1. Preencha instância e token (painel da Z-API > Instância > Tokens).
2. Clique em **Gerar QR Code** e escaneie com o celular.
3. Confira o bloco de estado no topo: tem que dizer "WhatsApp funcionando".
4. Clique em **Registrar avisos** (usa o `BACKEND_URL`).

---

## 6. Checklist antes de dizer que está no ar

```
[ ] /api/health responde
[ ] A landing mostra o nome do salão vindo do banco
[ ] Consegue agendar como cliente, num celular de verdade
[ ] A foto do profissional aparece na agenda
[ ] O bloco de estado do WhatsApp diz "funcionando"
[ ] Uma mensagem de teste chega no WhatsApp de verdade
[ ] /api/cron/lembretes responde 200 com a chave
[ ] O dono entra e o financeiro mostra o dia
[ ] Um profissional entra e NÃO vê as configurações do salão
[ ] F5 em /owner/funcionarios não mostra JSON
```

O penúltimo item é o teste de hierarquia. O terceiro é o que mais quebra em
deploy, e o motivo é o Vite: o proxy dele só existe em desenvolvimento, então
em produção a SPA precisa de `VITE_API_URL` configurada.

---

## 7. Se algo der errado

| Sintoma | Causa provável | Onde olhar |
|---|---|---|
| Foto some depois de subir | Imagens indo para o disco | As 3 variáveis do Supabase Storage |
| Bucket responde 403 | Bucket não é público | Storage > bucket > Policies |
| Código do cliente sempre inválido | Códigos em memória (versão antiga) | A tabela `verification_codes` existe? |
| Lembretes não saem | Cron não dispara | `CRON_SECRET` está definida? |
| "A conexão com o banco falhou" | URL errada ou conexão esgotada | `DATABASE_URL`; `DB_POOL_SIZE` |
| Erro intermitente no banco | Pooler (6543) em vez de direta (5432) | A porta na URL |
| JSON cru ao dar F5 | Faltou a rewrite do SPA | `vercel.json` > `rewrites` |
| A SPA não acha a API | `VITE_API_URL` não configurada | Variáveis do projeto no Vercel |
| "E-mail ou senha inválidos" no superadmin | Código de outro dia | `/superadmin` > Contas de acesso > gerar novo |

O log de auditoria responde "quem fez o quê" para quase tudo nesta tabela. Ele
não registra quando o sistema **sobe** — isso fica no log do provedor, e por
isso vale acompanhar o log da função no Vercel junto com a tela de auditoria.

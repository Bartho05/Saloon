# Como subir no Vercel

Guia de clicks. Explica onde cada parte vai e por quê, para quando der errado
você saber o que olhar.

**Dois projetos, não um.** O frontend e o backend viram dois projetos separados
no Vercel. Isso não é preferência: são dois tipos de coisa diferentes, com
domínios diferentes, e misturar faz o CORS e as variáveis de ambiente virarem
um mistério.

```
Projeto 1 — "site"     →  pasta frontend/  →  seu site
Projeto 2 — "api"      →  pasta backend/   →  a API
```

---

## Antes de começar

Você vai precisar de:

- conta no Vercel (github.com/login → Vercel)
- o `DATABASE_URL` do Supabase em mãos
- as três variáveis do Supabase Storage (para as fotos)
- um `SUPERADMIN_PEPPER` (gere com o comando da seção 5)

---

## 1. O banco de dados

**Você já tem isso.** O Supabase é o banco e continua onde está. O Vercel não
substitui o banco — ele só conecta nele.

Rode as migrations uma vez, na sua máquina:

```bash
cd backend
# ajuste o DATABASE_URL no .env com a URI do Supabase (porta 5432)
npx prisma migrate deploy
npx prisma generate
```

Se a sua instalação for nova, rode também o bootstrap do superadmin
(seção 6).

**Crie o bucket das imagens.** No painel do Supabase: Storage → New bucket →
nome `salao-imagens` → marque como **público**. Sem isso a foto dá 403 e parece
outro problema.

---

## 2. O backend (a API)

### No Vercel

1. **Add New → Project**
2. Importe o repositório
3. Configure:
   - **Root Directory:** `backend`
   - **Framework Preset:** Other
   - **Build Command:** `prisma generate`
   - **Install Command:** deixe em branco (o padrão já funciona)
4. **Deploy**

Pronto. A API fica em `https://SEU-PROJETO.vercel.app`.

**Não precisa de `NODE_ENV=production` no build.** O Vercel já define isso. E
definir de novo quebra o build: com `NODE_ENV=production`, o npm pula as
devDependencies, e o binário do `prisma` — que fica lá — simplesmente não
existe. O erro é `Command "prisma generate" exited with 127`, que é "comando
não encontrado" em Linux.

O `NODE_ENV=production` continuaindo na lista de variáveis, mas só para
**Runtime**, e serve para o sistema saber que está em produção. Se o build
falhar com 127, o motivo é ter colocado a variável no estágio errado, ou tê-la
removido.

Teste: `https://SEU-PROJETO.vercel.app/api/health` tem que responder
`{"status":"ok"}`. **Se der 404, a pasta `backend/api/index.ts` não foi
reconhecida** — confira se o Root Directory é `backend` e não a raiz do
repositório.

### Variáveis de ambiente

Settings → Environment Variables. Cole todas:

| Nome | Valor |
|---|---|
| `DATABASE_URL` | a URI do Supabase, **porta 5432** |
| `JWT_SECRET` | 48 bytes aleatórios |
| `JWT_REFRESH_SECRET` | 48 bytes aleatórios, **diferente** |
| `JWT_EXPIRES_IN` | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | `15d` |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | o domínio do site, **sem barra no final** |
| `BACKEND_URL` | `https://SEU-PROJETO.vercel.app` (sem barra) |
| `SUPABASE_URL` | Project URL, do painel |
| `SUPABASE_SERVICE_ROLE_KEY` | a que começa com `eyJ...` |
| `SUPABASE_STORAGE_BUCKET` | `salao-imagens` |
| `SUPERADMIN_PEPPER` | 32+ caracteres |
| `CRON_SECRET` | 32+ caracteres |
| `WHATSAPP_API_URL` | `https://api.z-api.io` |

**`BACKEND_URL` é o domínio do BACKEND, não do site.** É para onde a Z-API
manda os avisos de queda do WhatsApp. Trocar os dois é o motivo número um de
"registrei o aviso e nunca chegou nada".

Depois de salvar as variáveis, **redeploy** (Deployments → ⋮ → Redeploy). O
Vercel compila antes de você ter colado, então o primeiro deploy roda sem elas.

### As três rotinas

O `backend/vercel.json` já declara:

```
0 12 * * *   →  /api/cron/aniversarios
0 13 * * *   →  /api/cron/lembretes
0 6  * * *   →  /api/cron/limpeza
```

O horário é UTC: 12h UTC são 9h de São Paulo no horário de verão, 11h fora
dele. **O plano Hobby só permite uma execução por dia** — que é suficiente
aqui, porque as três são diárias.

O Vercel injeta o `CRON_SECRET` sozinho, desde que a variável tenha esse nome
exato.

Teste depois do deploy:
```bash
curl -H "Authorization: Bearer SEU_CRON_SECRET" \
  https://SEU-PROJETO.vercel.app/api/cron/lembretes
```
Resposta `{"rotina":"lembretes","sent":0,"failed":0}` significa que está
ligado.

---

## 3. O frontend (o site)

### No Vercel

1. **Add New → Project**
2. Importe o **mesmo** repositório
3. Configure:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. **Deploy**

### Variável de ambiente

Uma só:

| Nome | Valor |
|---|---|
| `VITE_API_URL` | `https://SEU-PROJETO-BACKEND.vercel.app` |

**Sem essa variável a API não funciona**, e o erro na tela vai dizer isso
("Não consegui falar com o servidor"), em vez de mostrar um
`Unexpected token '<'` que não ajuda.

### O domínio do site

Settings → Domains → Add. Depois volte ao projeto do **backend** e adicione o
mesmo domínio lá, na raiz (`api.seusite.com.br`), para a URL da API ficar
bonita. Se preferir, pode deixar a API no domínio do Vercel mesmo — só
atualize o `VITE_API_URL` e o `FRONTEND_URL`.

---

## 4. Depois do deploy, nesta ordem

1. **API responde?** `https://api.seusite.com.br/api/health`
2. **Site carrega?** `https://seusite.com.br`
3. **Página inicial mostra o nome do salão?** (vem do banco)
4. **Consigue entrar como dono?**
5. **A foto do profissional aparece?** (se não, é o bucket)
6. **WhatsApp mostra "funcionando"?**
7. **Agendar de verdade, pelo celular**

---

## 5. Gerando os segredos

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Rode duas vezes: uma para `JWT_SECRET`, outra para `JWT_REFRESH_SECRET`.
Depois, para o `SUPERADMIN_PEPPER` e o `CRON_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 6. Primeiro acesso ao sistema

Um sistema novo nasce sem dono. A ordem é:

1. Abra `https://seusite.com.br/superadmin`
2. Crie o superadmin (ele pede a `SUPERADMIN_BOOTSTRAP_SEED`)
3. Entre em **Proprietários** e crie o dono — isso destrava tudo
4. **Apague a `SUPERADMIN_BOOTSTRAP_SEED`** do Vercel e redeploye

O passo 4 importa: enquanto a semente existir, a porta de instalação fica
aberta. Quem a encontrar cria o próprio acesso máximo.

---

## Se der errado

| Sintoma | Causa | O que fazer |
|---|---|---|
| `/api/health` dá 404 | Root Directory errado | Confira se é `backend` |
| Site não chama a API | `VITE_API_URL` faltando | Adicione e redeploye |
| "Não consegui falar com o servidor" | API fora do ar ou URL errada | Teste o `/api/health` |
| CORS bloqueado no console | `FRONTEND_URL` errado | Sem barra no final, e deve ser o domínio exato do site |
| Foto dá 403 | Bucket não é público | Storage → bucket → Policies |
| Erro 500 em tudo | Falta `DATABASE_URL` | Copie a URI do Supabase |
| "too many connections" | Conexões esgotadas | O pool já é 1 em serverless; se insiste, use a porta 6543 (pooler) |
| Lembretes não saem | Cron não rodou | Teste o `/api/cron/lembretes` com o `CRON_SECRET` |
| F5 em `/owner/funcionarios` mostra JSON | Rewrite faltando | O `vercel.json` do frontend já tem; confira o Root Directory |
| Rotina roda duas vezes | Cron no plano e o `node-cron` local juntos | Em serverless o `node-cron` não sobe; se duplicar, veja "Ambiente" abaixo |

---

## Ambiente: como o sistema sabe onde está

Uma coisa que não é óbvia e evita um susto:

**`NODE_ENV=production` na sua máquina não desliga o cron.** Só o
`VERCEL=1` desliga. Isso é de propósito — é assim que se prova a configuração
de produção localmente antes de publicar. Se o cron desligasse por causa do
`NODE_ENV`, o teste de produção mentiria.

`config/ambiente.ts` é quem decide, e `config/database.ts` usa a mesma
informação para escolher o tamanho do pool de conexões: **5 num servidor
normal, 1 no serverless**. Cada instância do Vercel tem seu próprio pool, e 10
instâncias com pool 5 seriam 50 conexões — o Supabase derruba tudo com "too
many connections" bem no horário de pico.

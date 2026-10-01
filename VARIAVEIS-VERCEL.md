# As variáveis do Vercel, uma a uma

O Vercel **não quer que você suba um arquivo `.env`**. Ele pede cada variável
separada, em Settings → Environment Variables, com o nome e o valor em campos
distintos.

Se aparecer um pedido de arquivo, pode ignorar. Ele está lendo o
`.env.example` que está no repositório — aquele arquivo existe de propósito e
**não tem nenhum segredo**, é só a lista dos nomes.

---

## Ordem das etapas

A ordem importa porque uma URL depende da outra. Se tentar preencher tudo de
uma vez, não sabe ainda o endereço do outro projeto.

### Passo 1 — crie o projeto da API

Settings → General, renomeie o projeto para **`salao-api`**.

O endereço passa a ser `https://salao-api.vercel.app`. Anote. Ele não muda.

### Passo 2 — crie o projeto do site

Root Directory `frontend`, renomeie para **`salao-site`**.

O endereço passa a ser `https://salao-site.vercel.app`. Anote.

### Passo 3 — variables da API (`salao-api`)

Settings → Environment Variables → Add. Repita para cada linha da tabela.

| Nome | Onde achar o valor |
|---|---|
| `DATABASE_URL` | Supabase → Project Settings → Database → URI. **Porta 5432.** |
| `JWT_SECRET` | no seu `.env` local (veja o comando abaixo) |
| `JWT_REFRESH_SECRET` | no seu `.env` local |
| `JWT_EXPIRES_IN` | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | `15d` |
| `NODE_ENV` | `production` — **só em Runtime**, não em Build |
| `FRONTEND_URL` | `https://salao-site.vercel.app` — **sem barra no final** |
| `BACKEND_URL` | `https://salao-api.vercel.app` — **sem barra no final** |
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → a que começa com `eyJ` |
| `SUPABASE_STORAGE_BUCKET` | `salao-imagens` |
| `SUPERADMIN_PEPPER` | no seu `.env` local |
| `SUPERADMIN_BOOTSTRAP_SEED` | no seu `.env` local **por enquanto** |
| `CRON_SECRET` | no seu `.env` local |

### Passo 4 — uma variável do site (`salao-site`)

| Nome | Valor |
|---|---|
| `VITE_API_URL` | `https://salao-api.vercel.app` |

Só essa. O resto do backend nunca vai para o site.

### Passo 5 — redeploy nos dois

Deployments → ⋮ → Redeploy. O primeiro deploy compila antes de você ter
colado qualquer coisa, então não adianta tentar conferir antes disso.

---

## Se o build falhar

| Mensagem | Causa | O que fazer |
|---|---|---|
| `Command "prisma generate" exited with 127` | `NODE_ENV=production` no estágio de **Build**, que faz o npm pular as devDependencies | Mova a variável para **Runtime** e deixe o Build Command **vazio** — o `postinstall` já gera o client. Detalhes em `backend/BUILD-VERCEL.md` |
| `The api directory is not inside the project` | Root Directory errado | Confira se é `backend` |
| Erro 500 em tudo ao testar | Falta alguma variável | Compare com a tabela acima |

Erro 127 é "comando não encontrado" no Linux. Quase sempre é esse caso.

---

## Como copiar os valores do seu `.env` sem me mandar

Cada um destes imprime o valor na tela, para você copiar direto:

```bash
# um por vez
cd backend
node -e "console.log(require('dotenv').config().parsed.JWT_SECRET)"
node -e "console.log(require('dotenv').config().parsed.JWT_REFRESH_SECRET)"
node -e "console.log(require('dotenv').config().parsed.SUPERADMIN_PEPPER)"
node -e "console.log(require('dotenv').config().parsed.CRON_SECRET)"
```

O `DATABASE_URL` você já tem: é o mesmo do seu `.env`, com a URL do Supabase
de produção.

---

## Sobre a chave `service_role` do Supabase

**Ela não deve ir para o chat, nem para o repositório.** É o equivalente a
senha de administração do banco: ignora todas as regras de acesso e faz
qualquer coisa no banco, incluindo apagar tudo.

Ela só deve existir em dois lugares: a variável de ambiente do Vercel e o seu
`.env` local (que o git ignora). Vercel guarda as variáveis criptografadas.

Se em algum momento colar essa chave aqui por engano, troque-a no painel do
Supabase (Project Settings → API → Reset) antes de publicar.

---

## A ordem do primeiro acesso

Depois dos dois no ar:

1. Abra `https://salao-site.vercel.app/superadmin`
2. Crie o superadmin usando a `SUPERADMIN_BOOTSTRAP_SEED` que você colou
3. Entre em **Proprietários** e crie o dono do salão
4. **Apague a `SUPERADMIN_BOOTSTRAP_SEED`** do Vercel e redeploye

O passo 4 importa: enquanto a semente existir, a porta de instalação fica
aberta. Quem a encontrar cria o próprio acesso máximo ao sistema.

---

## Depois de subir: confira nesta ordem

1. `https://salao-api.vercel.app/api/health` → tem que responder `{"status":"ok"}`
2. `https://salao-site.vercel.app` → o site abre
3. A página inicial mostra o nome do salão (vem do banco)
4. Consegue entrar como dono
5. A foto do profissional aparece
6. Em Configurações → WhatsApp, aparece "WhatsApp funcionando"
7. Agendar de verdade, pelo celular

O item 1 é o mais importante para testar: isola se a API está de pé, sem
misturar com problema de site.

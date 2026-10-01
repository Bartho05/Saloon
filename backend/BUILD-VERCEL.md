# Por que o build do Vercel falhou, e o que cada coisa faz

Este arquivo é referência, não passo a passo. O passo a passo está em
`COMO-SUBIR.md`. Leia este se o build reclamar.

---

## `Command "prisma generate" exited with 127`

127 é "comando não encontrado" no Linux. No Vercel, nessa situação, é quase
sempre uma de duas coisas — e as duas já foram resolvidas.

### Causa 1: o binário não está no PATH do shell

O `postinstall` roda `prisma generate` e funciona, porque o npm coloca
`node_modules/.bin` no PATH ao rodar scripts. O Build Command roda em outro
shell, e às vezes esse PATH não inclui `node_modules/.bin`.

**Correção: deixe o Build Command VAZIO.**

O `postinstall` (`"postinstall": "prisma generate"`) já roda `prisma generate`
no fim de todo `npm install`. O client existe antes do build começar, como o
próprio log do Vercel mostra:

```
> salao-beleza-backend@1.0.0 postinstall
> prisma generate
✔ Generated Prisma Client (v5.22.0) in 116ms     ← já pronto
```

Se o Vercel exigir algum comando no campo, use `npx prisma generate` — o `npx`
acha o binário por conta própria.

### Causa 2: `NODE_ENV=production` no estágio de Build

Com essa variável, o npm **pula as devDependencies** na instalação. Se o
`prisma` estiver em `devDependencies`, o binário nunca é instalado.

**Correção: `NODE_ENV=production` só em Runtime, nunca em Build.**

Foi por isso que o `prisma` foi movido para `dependencies`: com ele lá, o
build não depende mais de estágio de configuração nem de flag do npm.

---

## `allowScripts`: o npm 12 mudou de comportamento

Em 2026 o **npm 12** passou a **não executar mais** `preinstall`, `install` e
`postinstall` das dependências sem aprovação explícita. É uma medida contra
ataque de cadeia de suprimento: um pacote comprometido já não roda código
assim que entra no `node_modules`.

Sem a aprovação, aparece no log:

```
npm warn install-scripts 5 packages have install scripts not yet covered by allowScripts
```

Os cinco deste projeto são `prisma`, `@prisma/client`, `@prisma/engines` e
duas versões do `esbuild`.

A lista está no `package.json`:

```json
"allowScripts": {
  "prisma": true,
  "@prisma/client": true,
  "@prisma/engines": true,
  "esbuild": true
}
```

**Por nome, e não por versão.** Fixado em `5.22.0`, um patch do Prisma deixaria
de casar e o script voltaria a ser bloqueado em silêncio — que é exatamente o
tipo de falha que aparece semanas depois, sem ninguém lembrar por quê.

### Isto era mesmo um risco?

Testado: com os scripts do Prisma bloqueados, o client é gerado pelo
`postinstall` do próprio projeto e **o app funciona** — consulta ao banco,
`/api/health`, tudo. O `@prisma/engines` baixo de versão já traz os binários
necessários.

Ou seja: a lista de aprovação não era obrigatória *hoje*. Ela está aqui para
que a próxima atualização do Prisma não vire uma manhã de build quebrado com um
erro que não menciona nenhuma das duas causas acima.

O script do projeto (`postinstall`) nunca foi afetado: a regra vale só para
dependências.

---

## `npm audit`: 6 vulnerabilidades

O log mostra `6 vulnerabilities (4 moderate, 1 high, 1 critical)`. Vem
inteiramente de dependências de **desenvolvimento** — `supertest`, `eslint`,
`rimraf` antigo, `glob` 7, `uuid` 8. Nada disso entra na imagem de produção:
são ferramentas de teste e lint.

`npm audit fix --force` não deve ser usado aqui: ele atualiza versão major de
`supertest` e `eslint` e pode quebrar a suíte de testes. Quando as ferramentas
são atualizadas na manutenção, o problema some.

---

## Aviso do `engines`

```
Warning: Detected "engines": { "node": ">=20.0.0" } in your `package.json`
that will automatically upgrade when a new major Node.js Version is released
```

É informativo. O Vercel acompanha a major nova do Node sozinho. Para fixar a
versão, use `.nvmrc` ou `VERCEL` > Settings > General > Node.js Version.

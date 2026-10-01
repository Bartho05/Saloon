/**
 * Adaptador para função serverless do Vercel.
 *
 * ── O que este arquivo é ────────────────────────────────────────────────────
 *
 * O Vercel não roda um servidor Express: ele importa um módulo e espera que ele
 * exporte um handler. Este arquivo é a cola entre os dois — importa o app (que é
 * um Express normal) e exporta como função.
 *
 * São cinco linhas, e a extensão `.ts` é necessária porque o Vercel compila
 * TypeScript no build.
 *
 * ── O que NÃO é aqui, e por quê ────────────────────────────────────────────
 *
 * **Não chama `app.listen`.** Serverless não abre porta: a Vercel chama a função
 * e recebe a resposta. Abrir socket aqui não faria o site funcionar, faria o
 * deploy passar por um caminho que nunca é exercitado.
 *
 * **Não conecta no banco.** O Prisma abre a conexão na primeira consulta, e
 * conectar eagerly custaria uma função fria a mais em toda requisição.
 *
 * **Não inicia o cron.** O `app.ts` já cuida disso, checando se está em
 * serverless — ver `config/ambiente.ts`.
 *
 * ── O que precisa estar resolvido para isto funcionar ──────────────────────
 *
 * Os aliases (`@config`, `@services`, `@middlewares`) e o `tsconfig.json` estão
 * na raiz do `backend`, que é a raiz deste projeto no Vercel. O Vercel compila a
 * partir da raiz, então os dois são encontrados normalmente.
 */
import app from '../src/app';

export default app;

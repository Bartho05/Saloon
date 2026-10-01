/**
 * Onde o código está rodando.
 *
 * Existe uma pergunta que o resto do sistema não faz sozinho, e ela não é
 * "estou em produção?". É "existe um processo de verdade aqui?".
 *
 * ── Por que não usar NODE_ENV ────────────────────────────────────────────────
 *
 * Porque `NODE_ENV=production` na máquina local é exatamente como se prova a
 * configuração de produção antes de subir. E é assim que este projeto
 * funciona: subir em `production` local, conferir tudo, e só então publicar. Se o
 * cron se desligasse por causa de `NODE_ENV`, o teste de produção mentiria —
 * diria que a rotina está desligada quando na verdade está de pé, ou o
 * contrário.
 *
 * ── Por que o Vercel e não uma variável minha ───────────────────────────────
 *
 * `VERCEL=1` é injetada pelo Vercel em toda função. Não depende de o
 * operador lembrar de preencher nada, e não tem como estar errada por
 * esquecimento. Um flag que o próprio ambiente define é mais confiável que um
 * que alguém precisa configurar.
 */

/** Estou rodando como função serverless, sem processo servidor? */
export const emServerless = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;

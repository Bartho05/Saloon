import { Router } from 'express';
import {
  cronAniversarios,
  cronLembretes,
  cronLimpeza,
} from '@controllers/cronController';

const router = Router();

/**
 * Rotinas que alguém precisa chamar de fora.
 *
 * Ficam sob `/api` e NÃO sob `/owner`: não há sessão de usuário aqui, quem
 * chama é um agendador. A proteção é o `CRON_SECRET` no header, conferido em
 * cada rota.
 *
 * Ficam fora do rate limiter global de propósito. Um agendador legítimo não
 * gera tráfego de SPA, e barrar a rotina de aniversário porque o dono está
 * navegando no painel seria o pior tipo de falha: silenciosa e com efeito
 * num dia que não se repete.
 */
router.get('/aniversarios', cronAniversarios);
router.get('/lembretes', cronLembretes);
router.get('/limpeza', cronLimpeza);

export default router;

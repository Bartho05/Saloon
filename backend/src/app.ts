import express, { Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import { env } from '@config/env';
import { globalRateLimiter } from '@middlewares/rateLimiter';
import { errorHandler, notFoundHandler } from '@middlewares/errorHandler';
import authRoutes from '@routes/authRoutes';
import publicRoutes from '@routes/publicRoutes';
import ownerRoutes from '@routes/ownerRoutes';
import employeeRoutes from '@routes/employeeRoutes';
import clientRoutes from '@routes/clientRoutes';
import superadminRoutes from '@routes/superadminRoutes';
import cronRoutes from '@routes/cronRoutes';
import { startCronJobs } from '@services/cronService';
import { usandoSupabase, UPLOAD_ROOT_DISCO } from '@services/imageStorage';
import { emServerless } from '@config/ambiente';

const app = express();

// Trust proxy (para rate limiter funcionar atrás de proxy)
app.set('trust proxy', 1);

// Middlewares globais
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/*
 * Imagens enviadas.
 *
 * Só existe quando as imagens vão para o disco local, ou seja, em
 * desenvolvimento. Em produção com Supabase Storage, a URL da foto já é a
 * URL pública do Supabase e este `static` não tem o que servir.
 *
 * O `if` não é otimização: montar o `static` resolveria o diretório e criaria
 * a pasta `uploads/` num sistema de arquivos somente leitura, e o processo
 * não subiria. A tela do dono mostra em qual dos dois as imagens estão, porque
 * essa diferença explica a maior parte dos "a foto sumiu".
 */
if (!usandoSupabase()) {
  app.use(
    '/uploads',
    express.static(path.resolve(UPLOAD_ROOT_DISCO), {
      maxAge: '7d',
      // o nome do arquivo já é aleatório, mas o path resolve é defensivo
      dotfiles: 'deny',
    })
  );
}

app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(globalRateLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rotas
//
// Tudo é montado sob o prefixo /api. Isso é obrigatório: o frontend é uma SPA
// que também usa rotas /owner/*, /funcionario/*, /agendar etc. Se a API
// respondesse na raiz, um simples F5 em /owner/funcionarios cairia no backend
// em vez do index.html do Vite — e o usuário veria um JSON cru na tela.
const api = Router();
api.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
api.use('/auth', authRoutes);
api.use('/', publicRoutes);
api.use('/owner', ownerRoutes);
api.use('/employee', employeeRoutes);
api.use('/client', clientRoutes);
api.use('/superadmin', superadminRoutes);
api.use('/cron', cronRoutes);

app.use('/api', api);

// Montagens na raiz existem apenas para guarda e testes diretos (curl,
// healthcheck). O frontend NUNCA deve usar esses prefixos.
app.use('/auth', authRoutes);
app.use('/', publicRoutes);
app.use('/owner', ownerRoutes);
app.use('/employee', employeeRoutes);
app.use('/client', clientRoutes);
app.use('/superadmin', superadminRoutes);
// `/cron` NÃO é montado na raiz de propósito: é a única rota que muda dados
// e não tem sessão. Publicada só sob `/api`, fica fora do alcance de um
// `GET` disparado por link clicado, e o agendador sempre aponta para o
// caminho completo.
app.use('/api/cron', cronRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

/*
 * Inicia os jobs agendados — e só num servidor de verdade.
 *
 * Este módulo é importado pela função serverless, e lá um `node-cron` é
 * problemático de um jeito específico: o timer é criado, ocupa memória, e nunca
 * chega a disparar, porque a função é congelada assim que termina de responder.
 * Pior, como as instâncias do Vercel são descartadas e recriadas, cada uma
 * deixaria um timer órfão para trás.
 *
 * A verificação é pelo `VERCEL`, e não por `NODE_ENV`: dá para rodar em
 * `NODE_ENV=production` na máquina de desenvolvimento — que é como a
 * configuração de produção se prova — e ainda assim ter o cron funcionando
 * local, que é o que se quer ao testar.
 */
if (env.NODE_ENV !== 'test' && !emServerless) {
  startCronJobs();
}

export default app;
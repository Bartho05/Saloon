import express, { Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import { UPLOAD_ROOT } from '@services/uploadService';
import { env } from '@config/env';
import { globalRateLimiter } from '@middlewares/rateLimiter';
import { errorHandler, notFoundHandler } from '@middlewares/errorHandler';
import authRoutes from '@routes/authRoutes';
import publicRoutes from '@routes/publicRoutes';
import ownerRoutes from '@routes/ownerRoutes';
import employeeRoutes from '@routes/employeeRoutes';
import clientRoutes from '@routes/clientRoutes';
import superadminRoutes from '@routes/superadminRoutes';
import { startCronJobs } from '@services/cronService';

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

// Imagens enviadas (logo do salão, foto dos funcionários)
app.use(
  '/uploads',
  express.static(UPLOAD_ROOT, {
    maxAge: '7d',
    // o nome do arquivo já é aleatório, mas o path resolve é defensivo
    dotfiles: 'deny',
  })
);
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

app.use('/api', api);

// Montagens na raiz existem apenas para guarda e testes diretos (curl,
// healthcheck). O frontend NUNCA deve usar esses prefixos.
app.use('/auth', authRoutes);
app.use('/', publicRoutes);
app.use('/owner', ownerRoutes);
app.use('/employee', employeeRoutes);
app.use('/client', clientRoutes);
app.use('/superadmin', superadminRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// Inicia jobs agendados
if (env.NODE_ENV !== 'test') {
  startCronJobs();
}

export default app;
import 'dotenv/config';
import app from './app';
import { env } from '@config/env';
import prisma from '@config/database';

const PORT = env.PORT;

async function startServer(): Promise<void> {
  try {
    // Testa conexão com banco
    await prisma.$connect();
    console.log('✅ Conectado ao banco de dados');

    const server = app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      console.log(`🌍 Ambiente: ${env.NODE_ENV}`);
      console.log(`📱 Frontend URL: ${env.FRONTEND_URL}`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Recebido ${signal}. Encerrando...`);
      server.close(async () => {
        console.log('🔌 Servidor HTTP fechado');
        await prisma.$disconnect();
        console.log('🔌 Conexão com banco fechada');
        process.exit(0);
      });

      // Force close after 10s
      setTimeout(() => {
        console.error('⚠️ Forçando encerramento...');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

startServer();
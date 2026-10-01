import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@services': path.resolve(__dirname, './src/services'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types'),
      '@contexts': path.resolve(__dirname, './src/contexts'),
      '@layouts': path.resolve(__dirname, './src/layouts'),
      '@styles': path.resolve(__dirname, './src/styles'),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      // SOMENTE /api e /uploads são encaminhados ao backend.
      //
      // Nunca adicione aqui /owner, /employee, /services etc: essas são
      // também rotas de página da SPA. Com proxy em /owner, um F5 em
      // /owner/funcionarios ia para o backend e o usuário via um JSON cru.
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Imagens (logo do salão, fotos dos funcionários) servidas pelo
      // express.static. Não colide com rota de página: o SPA não tem /uploads.
      // Sem isso o Vite devolve o index.html com 200 e a imagem nunca carrega —
      // um 200 que mente sobre o conteúdo.
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
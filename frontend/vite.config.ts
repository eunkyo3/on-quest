import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    // 프로덕션 번들에는 소스맵을 노출하지 않는다(인증 로직 등 원본 유출 방지).
    sourcemap: mode !== 'production',
  },
}));

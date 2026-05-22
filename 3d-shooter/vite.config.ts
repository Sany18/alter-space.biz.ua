import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(process.cwd(), '..'), '');

  const domain: string = env.DOMAIN ?? 'localhost';
  const wsPort: string = env.SHOOTER_WS_PORT ?? '3001';
  const wsUrl: string = (mode === 'production' && domain !== 'localhost')
    ? `wss://${domain}/3d-shooter/ws`
    : `ws://localhost:${wsPort}`;

  return {
    plugins: [react()],
    base: `/${env.SHOOTER_BASE}/`,
    server: {
      port: Number(env.SHOOTER_DEV_PORT ?? 5173),
      strictPort: true,
    },
    define: {
      __APP_DOMAIN__: JSON.stringify(domain),
      __APP_WS_URL__: JSON.stringify(wsUrl),
    },
  }
});

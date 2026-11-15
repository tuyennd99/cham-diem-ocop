import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

export async function createViteSsrTestServer() {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  return createServer({
    root,
    configFile: false,
    envDir: false,
    appType: 'custom',
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('../../src', import.meta.url)),
        '@ocop/shared': fileURLToPath(
          new URL('../../../../packages/shared/src/index.ts', import.meta.url),
        ),
      },
    },
    ssr: {
      noExternal: ['lodash'],
      optimizeDeps: {
        include: [
          'react',
          'react-dom',
          'zustand',
          '@tanstack/react-query',
          '@tanstack/react-form',
          'axios',
          'lodash',
        ],
      },
    },
    server: { middlewareMode: true, watch: null, hmr: false },
  });
}

import { StrictMode } from 'react';
import { RouterProvider } from '@tanstack/react-router';
import { hydrate } from '@tanstack/react-router/ssr/client';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { router } from './router';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root application element');

declare global {
  interface Window {
    $_TSR?: {
      h?: () => void;
      router?: unknown;
    };
  }
}

async function bootstrap() {
  const hasSsrBootstrap = Boolean(window.$_TSR?.router) && root!.hasChildNodes();
  const app = (
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  );

  if (hasSsrBootstrap) {
    try {
      await hydrate(router);
    } finally {
      window.$_TSR?.h?.();
    }
    hydrateRoot(root!, app);
    return;
  }

  createRoot(root!).render(app);
}

void bootstrap();

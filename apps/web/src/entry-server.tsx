import { RouterContextProvider, Scripts } from '@tanstack/react-router';
import {
  createRequestHandler,
  defineHandlerCallback,
  renderRouterToString,
} from '@tanstack/react-router/ssr/server';
import { StartServer } from '@tanstack/react-start/server';
import { DEFAULT_OG_IMAGE_PATH, resolvePublicOrigin } from './lib/seo';
import {
  buildDefaultOgImageResponse,
  buildRobotsTxtResponse,
  buildSitemapXmlResponse,
} from './lib/sitemap';
import { createAppRouter } from './router';

export interface RenderAppRequestOptions {
  origin?: string;
  clientEntrySrc?: string;
  stylesheetHrefs?: string[];
}

export async function renderAppRequest(
  request: Request,
  options: RenderAppRequestOptions = {},
): Promise<Response> {
  const parsedUrl = (() => {
    try {
      return new URL(request.url);
    } catch {
      return null;
    }
  })();
  const requestOrigin = options.origin ?? parsedUrl?.origin;
  const publicOrigin = resolvePublicOrigin(requestOrigin);

  if (parsedUrl?.pathname === '/robots.txt') {
    return buildRobotsTxtResponse(publicOrigin);
  }

  if (parsedUrl?.pathname === '/sitemap.xml') {
    return buildSitemapXmlResponse(publicOrigin);
  }

  if (parsedUrl?.pathname === DEFAULT_OG_IMAGE_PATH) {
    return buildDefaultOgImageResponse();
  }

  const clientEntrySrc = options.clientEntrySrc ?? '/src/main.tsx';
  const stylesheetHrefs = options.stylesheetHrefs ?? [];

  const handler = createRequestHandler({
    request,
    createRouter: () => createAppRouter({ origin: publicOrigin }),
  });

  return handler(
    defineHandlerCallback(({ router, responseHeaders }) =>
      renderRouterToString({
        router,
        responseHeaders,
        children: (
          <RouterContextProvider router={router}>
            <html lang='vi'>
              <head>
                <meta charSet='UTF-8' />
                <meta name='viewport' content='width=device-width, initial-scale=1.0' />
                <meta name='theme-color' content='#f7faf8' />
                <link rel='preconnect' href='https://fonts.googleapis.com' />
                <link rel='preconnect' href='https://fonts.gstatic.com' crossOrigin='' />
                <link
                  href='https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Lora:wght@500;600;700&display=swap'
                  rel='stylesheet'
                />
                {stylesheetHrefs.map((href) => (
                  <link key={href} rel='stylesheet' href={href} />
                ))}
              </head>
              <body>
                <div id='root'>
                  <StartServer router={router} />
                </div>
                <Scripts />
                <script type='module' src={clientEntrySrc} />
              </body>
            </html>
          </RouterContextProvider>
        ),
      }),
    ),
  );
}

export default renderAppRequest;

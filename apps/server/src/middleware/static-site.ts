import { sep } from 'node:path';
import express, { Router } from 'express';

/** Vite fingerprints everything under /assets, so those files can be cached forever. */
const IMMUTABLE = 'public, max-age=31536000, immutable';

/**
 * Serves the built single-page app. Mounted after the API so it can never shadow /api routes.
 * Unknown GET routes fall back to index.html for client-side navigation; missing assets 404.
 */
export function serveStaticSite(staticDir: string): Router {
  const router = Router();

  router.use(
    express.static(staticDir, {
      index: false,
      setHeaders(res, filePath) {
        res.setHeader('Cache-Control', filePath.includes(`${sep}assets${sep}`) ? IMMUTABLE : 'no-cache');
      },
    }),
  );

  router.get('/{*path}', (req, res, next) => {
    if (req.path.startsWith('/assets/')) {
      next();
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile('index.html', { root: staticDir });
  });

  return router;
}

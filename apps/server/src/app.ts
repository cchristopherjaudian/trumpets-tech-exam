import type { WidgetId } from '@text-widgets/shared';
import express, { type Express } from 'express';
import { apiNotFound, createErrorHandler, type Logger } from './middleware/error-handler.js';
import { InMemoryWidgetRepository } from './repositories/in-memory-widget.repository.js';
import type { WidgetRepository } from './repositories/widget.repository.js';
import { serveStaticSite } from './middleware/static-site.js';
import { createWidgetsRouter } from './routes/widgets.router.js';
import { createWidgetService } from './services/widget.service.js';

/**
 * Covers MAX_TEXT_LENGTH in the worst case: control characters JSON-escape to 6 bytes
 * each (50,000 × 6 = 300 KB) plus the envelope.
 */
const JSON_BODY_LIMIT = '512kb';

export interface AppDependencies {
  repository?: WidgetRepository;
  clock?: () => Date;
  generateId?: () => WidgetId;
  logger?: Logger;
  /** Directory of the built web app; when set, it is served alongside the API. */
  staticDir?: string;
}

/** Composition root: wires storage, service and HTTP layers (and optionally the web app) into Express. */
export function createApp({
  repository = new InMemoryWidgetRepository(),
  clock,
  generateId,
  logger = console,
  staticDir,
}: AppDependencies = {}): Express {
  const service = createWidgetService({
    repository,
    ...(clock && { clock }),
    ...(generateId && { generateId }),
  });

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api/widgets', createWidgetsRouter(service));
  app.use('/api', apiNotFound);

  if (staticDir) {
    app.use(serveStaticSite(staticDir));
  }

  app.use(createErrorHandler(logger));
  return app;
}

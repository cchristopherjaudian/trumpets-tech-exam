import {
  CreateWidgetRequestSchema,
  UpdateWidgetRequestSchema,
  WidgetIdParamsSchema,
  type ListWidgetsResponse,
} from '@text-widgets/shared';
import { Router } from 'express';
import { notFoundError } from '../errors.js';
import { validate } from '../middleware/validate.js';
import type { ServiceError, WidgetService } from '../services/widget.service.js';

const toHttpError = (error: ServiceError) => notFoundError(`Widget ${error.id} not found`);

export function createWidgetsRouter(service: WidgetService): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const body: ListWidgetsResponse = { widgets: service.list() };
    res.json(body);
  });

  router.post('/', validate({ body: CreateWidgetRequestSchema }), (req, res) => {
    res.status(201).json(service.create(req.body));
  });

  router.patch(
    '/:id',
    validate({ params: WidgetIdParamsSchema, body: UpdateWidgetRequestSchema }),
    (req, res) => {
      const result = service.updateText(req.params.id, req.body.text);
      if (!result.ok) throw toHttpError(result.error);
      res.json(result.value);
    },
  );

  router.delete('/:id', validate({ params: WidgetIdParamsSchema }), (req, res) => {
    const result = service.delete(req.params.id);
    if (!result.ok) throw toHttpError(result.error);
    res.status(204).end();
  });

  return router;
}

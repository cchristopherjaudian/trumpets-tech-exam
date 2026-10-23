import { randomUUID } from 'node:crypto';
import type { CreateWidgetRequest, Widget, WidgetId } from '@text-widgets/shared';
import type { WidgetRepository } from '../repositories/widget.repository.js';

export type ServiceError = { kind: 'NOT_FOUND'; id: WidgetId };

export type ServiceResult<T> = { ok: true; value: T } | { ok: false; error: ServiceError };

/**
 * Widget lifecycle rules, independent of HTTP. Inputs are expected to have been validated
 * against the shared schemas already; failures are returned as results, never thrown.
 */
export interface WidgetService {
  list(): Widget[];
  create(input: CreateWidgetRequest): Widget;
  updateText(id: WidgetId, text: string): ServiceResult<Widget>;
  delete(id: WidgetId): ServiceResult<void>;
}

export interface WidgetServiceDependencies {
  repository: WidgetRepository;
  clock?: () => Date;
  generateId?: () => WidgetId;
}

export function createWidgetService({
  repository,
  clock = () => new Date(),
  generateId = randomUUID,
}: WidgetServiceDependencies): WidgetService {
  const timestamp = () => clock().toISOString();
  const notFound = (id: WidgetId) => ({ ok: false, error: { kind: 'NOT_FOUND', id } }) as const;

  return {
    list: () => repository.list(),

    create({ text }) {
      const createdAt = timestamp();
      const widget: Widget = { id: generateId(), text, createdAt, updatedAt: createdAt };
      repository.insert(widget);
      return widget;
    },

    updateText(id, text) {
      const existing = repository.get(id);
      if (!existing) {
        return notFound(id);
      }
      const updated: Widget = { ...existing, text, updatedAt: timestamp() };
      repository.update(updated);
      return { ok: true, value: updated };
    },

    delete(id) {
      return repository.delete(id) ? { ok: true, value: undefined } : notFound(id);
    },
  };
}

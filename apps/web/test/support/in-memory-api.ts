import type { Widget } from '@text-widgets/shared';
import { vi } from 'vitest';
import type { Result } from '../../src/api/result.js';
import type { WidgetApi } from '../../src/api/widget-api.js';

const networkError: Result<never> = {
  ok: false,
  error: { kind: 'network', message: 'Failed to fetch' },
};

/**
 * A fake Widget Service that stores widgets in memory like the real server, so flows such
 * as "type, reload, see the same text" can be exercised without HTTP. Every method is a spy.
 */
export function createInMemoryApi(initial: Widget[] = []) {
  const store = new Map(initial.map((widget) => [widget.id, { ...widget }]));
  let nextId = initial.length;

  const result = <T>(value: () => T): Promise<Result<T>> =>
    Promise.resolve({ ok: true, value: value() });

  const api = {
    list: vi.fn<WidgetApi['list']>(() => result(() => [...store.values()].map((w) => ({ ...w })))),
    create: vi.fn<WidgetApi['create']>(() =>
      result(() => {
        const widget: Widget = {
          id: `w${++nextId}`,
          text: '',
          createdAt: '2026-10-23T00:00:00.000Z',
          updatedAt: '2026-10-23T00:00:00.000Z',
        };
        store.set(widget.id, widget);
        return { ...widget };
      }),
    ),
    updateText: vi.fn<WidgetApi['updateText']>((id, text) =>
      result(() => {
        const existing = store.get(id);
        if (!existing) throw new Error(`updateText for missing widget ${id}`);
        const updated = { ...existing, text };
        store.set(id, updated);
        return { ...updated };
      }),
    ),
    remove: vi.fn<WidgetApi['remove']>((id) =>
      result(() => {
        store.delete(id);
      }),
    ),
  } satisfies WidgetApi;

  return {
    api,
    /** What the "server" currently stores, in order. */
    stored: () => [...store.values()].map(({ id, text }) => ({ id, text })),
    /** Makes the next call to `method` fail with a network error. */
    failNext(method: keyof WidgetApi) {
      (api[method] as ReturnType<typeof vi.fn>).mockResolvedValueOnce(networkError);
    },
  };
}

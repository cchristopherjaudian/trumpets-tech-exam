import type { Widget } from '@text-widgets/shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiError, Result } from '../../src/api/result.js';
import { WidgetApiProvider } from '../../src/api/widget-api-context.js';
import type { WidgetApi } from '../../src/api/widget-api.js';
import {
  createAutosaveScheduler,
  type AutosaveScheduler,
} from '../../src/autosave/autosave-scheduler.js';
import { useWidgets } from '../../src/hooks/use-widgets.js';

const widget = (id: string, text = ''): Widget => ({
  id,
  text,
  createdAt: '2026-10-23T00:00:00.000Z',
  updatedAt: '2026-10-23T00:00:00.000Z',
});

const ok = <T,>(value: T): Result<T> => ({ ok: true, value });
const networkError: Result<never> = {
  ok: false,
  error: { kind: 'network', message: 'Failed to fetch' },
};
const httpError = (status: number, code: Extract<ApiError, { kind: 'http' }>['code']): Result<never> => ({
  ok: false,
  error: { kind: 'http', status, code, message: 'nope' },
});

/** A promise the test resolves explicitly, to observe intermediate states. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function fakeApi() {
  return {
    list: vi.fn<WidgetApi['list']>(async () => ok([])),
    create: vi.fn<WidgetApi['create']>(),
    updateText: vi.fn<WidgetApi['updateText']>(async (id, text) => ok(widget(id, text))),
    remove: vi.fn<WidgetApi['remove']>(async () => ok(undefined)),
  };
}

describe('useWidgets', () => {
  let api: ReturnType<typeof fakeApi>;
  let scheduler: AutosaveScheduler;

  beforeEach(() => {
    api = fakeApi();
    scheduler = createAutosaveScheduler({ save: api.updateText });
  });

  const renderUseWidgets = () =>
    renderHook(() => useWidgets(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <WidgetApiProvider api={api} scheduler={scheduler}>
          {children}
        </WidgetApiProvider>
      ),
    });

  const loaded = async (...widgets: Widget[]) => {
    api.list.mockResolvedValueOnce(ok(widgets));
    const hook = renderUseWidgets();
    await waitFor(() => expect(hook.result.current.state.phase).toBe('ready'));
    return hook;
  };

  describe('loading', () => {
    it('loads widgets on mount, showing loading first', async () => {
      const pending = deferred<Result<Widget[]>>();
      api.list.mockReturnValueOnce(pending.promise);

      const { result } = renderUseWidgets();
      expect(result.current.state).toEqual({ phase: 'loading' });

      await act(async () => pending.resolve(ok([widget('a', 'hello'), widget('b')])));

      expect(result.current.state).toEqual({
        phase: 'ready',
        widgets: [widget('a', 'hello'), widget('b')],
        pendingCreates: 0,
      });
      expect(api.list).toHaveBeenCalledWith(expect.any(AbortSignal));
    });

    it('seeds the autosave baseline for each loaded widget', async () => {
      await loaded(widget('a', 'stored'));

      expect(scheduler.peek('a')).toEqual({ lastSaved: 'stored', draft: 'stored' });
    });

    it('shows an error when loading fails and recovers on reload', async () => {
      api.list.mockResolvedValueOnce(networkError);
      const { result } = renderUseWidgets();
      await waitFor(() => expect(result.current.state.phase).toBe('error'));
      expect(result.current.state).toEqual({
        phase: 'error',
        message: 'Could not load widgets. Check your connection and try again.',
      });

      api.list.mockResolvedValueOnce(ok([widget('a')]));
      act(() => result.current.reload());
      expect(result.current.state.phase).toBe('loading');

      await waitFor(() => expect(result.current.state.phase).toBe('ready'));
      expect(api.list).toHaveBeenCalledTimes(2);
    });

    it('aborts the in-flight load on unmount', async () => {
      api.list.mockReturnValueOnce(new Promise(() => {}));
      const { unmount } = renderUseWidgets();
      const signal = api.list.mock.calls[0]?.[0];

      unmount();

      expect(signal?.aborted).toBe(true);
    });
  });

  describe('adding', () => {
    it('creates a widget per call and appends each in order', async () => {
      const { result } = await loaded(widget('a'));
      api.create.mockResolvedValueOnce(ok(widget('b'))).mockResolvedValueOnce(ok(widget('c')));

      await act(async () => {
        await result.current.addWidget();
        await result.current.addWidget();
      });

      expect(api.create).toHaveBeenCalledTimes(2);
      expect(result.current.state).toMatchObject({
        widgets: [widget('a'), widget('b'), widget('c')],
        pendingCreates: 0,
      });
      expect(scheduler.peek('b')).toEqual({ lastSaved: '', draft: '' });
    });

    it('counts pending creations without blocking further clicks', async () => {
      const { result } = await loaded();
      const first = deferred<Result<Widget>>();
      const second = deferred<Result<Widget>>();
      api.create.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

      act(() => {
        void result.current.addWidget();
        void result.current.addWidget();
      });
      expect(result.current.state).toMatchObject({ pendingCreates: 2 });

      await act(async () => {
        first.resolve(ok(widget('x')));
        second.resolve(ok(widget('y')));
      });
      expect(result.current.state).toMatchObject({ pendingCreates: 0 });
    });

    it('shows a dismissible notice when creation fails', async () => {
      const { result } = await loaded(widget('a'));
      api.create.mockResolvedValueOnce(networkError);

      await act(() => result.current.addWidget());

      expect(result.current.state).toMatchObject({
        widgets: [widget('a')],
        notice: 'Could not add a widget. Please try again.',
      });

      act(() => result.current.dismissNotice());
      expect(result.current.state).not.toHaveProperty('notice');
    });
  });

  describe('deleting', () => {
    it('removes the widget immediately, cancels its pending save, then deletes it', async () => {
      const { result } = await loaded(widget('a'), widget('b'));
      scheduler.schedule('a', 'unsaved edit');
      const removal = deferred<Result<void>>();
      api.remove.mockReturnValueOnce(removal.promise);

      act(() => {
        void result.current.deleteWidget('a');
      });

      expect(result.current.state).toMatchObject({ widgets: [widget('b')] });
      expect(scheduler.peek('a')).toBeUndefined();
      expect(api.remove).toHaveBeenCalledWith('a');

      await act(async () => removal.resolve(ok(undefined)));
      scheduler.flushAll();
      expect(api.updateText).not.toHaveBeenCalled();
      expect(result.current.state).toMatchObject({ widgets: [widget('b')] });
    });

    it('leaves the other widgets and their text untouched', async () => {
      const { result } = await loaded(widget('a', 'one'), widget('b', 'two'), widget('c', 'three'));

      await act(() => result.current.deleteWidget('b'));

      expect(result.current.state).toMatchObject({
        widgets: [widget('a', 'one'), widget('c', 'three')],
      });
    });

    it('restores the widget in place with its latest draft when deletion fails', async () => {
      const { result } = await loaded(widget('a'), widget('b', 'stored'), widget('c'));
      scheduler.schedule('b', 'stored + unsaved');
      api.remove.mockResolvedValueOnce(networkError);

      await act(() => result.current.deleteWidget('b'));

      expect(result.current.state).toMatchObject({
        widgets: [widget('a'), widget('b', 'stored + unsaved'), widget('c')],
        notice: 'Could not delete the widget. Please try again.',
      });
      expect(scheduler.peek('b')).toEqual({ lastSaved: 'stored', draft: 'stored + unsaved' });
      expect(scheduler.getStatus('b')).toBe('pending');
    });

    it('treats an already-deleted widget as successfully deleted', async () => {
      const { result } = await loaded(widget('a'));
      api.remove.mockResolvedValueOnce(httpError(404, 'NOT_FOUND'));

      await act(() => result.current.deleteWidget('a'));

      expect(result.current.state).toEqual({ phase: 'ready', widgets: [], pendingCreates: 0 });
    });
  });
});

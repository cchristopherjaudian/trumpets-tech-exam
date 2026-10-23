import type { Widget } from '@text-widgets/shared';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useAutosaveScheduler,
  useWidgetApi,
  WidgetApiProvider,
} from '../../src/api/widget-api-context.js';
import type { WidgetApi } from '../../src/api/widget-api.js';
import type { AutosaveScheduler } from '../../src/autosave/autosave-scheduler.js';

const ID = 'widget-1';

function fakeApi() {
  return {
    list: vi.fn<WidgetApi['list']>(),
    create: vi.fn<WidgetApi['create']>(),
    remove: vi.fn<WidgetApi['remove']>(),
    updateText: vi.fn<WidgetApi['updateText']>(async (id, text) => ({
      ok: true as const,
      value: { id, text, createdAt: '', updatedAt: '' } satisfies Widget,
    })),
  };
}

/** Renders the provider and captures the services it exposes. */
function renderServices(api: WidgetApi, scheduler?: AutosaveScheduler) {
  const captured: { scheduler?: AutosaveScheduler; api?: WidgetApi } = {};
  function Probe() {
    captured.scheduler = useAutosaveScheduler();
    captured.api = useWidgetApi();
    return null;
  }
  const utils = render(
    <WidgetApiProvider api={api} {...(scheduler && { scheduler })}>
      <Probe />
    </WidgetApiProvider>,
  );
  const services = captured as Required<typeof captured>;
  return { ...utils, services };
}

const setVisibility = (state: DocumentVisibilityState) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
};

describe('WidgetApiProvider app services', () => {
  let api: ReturnType<typeof fakeApi>;

  beforeEach(() => {
    vi.useFakeTimers();
    api = fakeApi();
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  });

  it('provides one autosave scheduler whose saves go through the API client', async () => {
    const { services } = renderServices(api);

    services.scheduler.markSaved(ID, '');
    services.scheduler.schedule(ID, 'hello');
    await act(() => services.scheduler.flush(ID));

    expect(api.updateText).toHaveBeenCalledWith(ID, 'hello', { keepalive: false });
    expect(services.api).toBe(api);
  });

  it('keeps the same scheduler across re-renders', () => {
    const seen = new Set<AutosaveScheduler>();
    function Probe() {
      seen.add(useAutosaveScheduler());
      return null;
    }
    const { rerender } = render(
      <WidgetApiProvider api={api}>
        <Probe />
      </WidgetApiProvider>,
    );
    rerender(
      <WidgetApiProvider api={api}>
        <Probe />
      </WidgetApiProvider>,
    );

    expect(seen.size).toBe(1);
  });

  it('uses an injected scheduler when given one', () => {
    const scheduler = { flushAll: vi.fn(), dispose: vi.fn() } as unknown as AutosaveScheduler;

    const { services } = renderServices(api, scheduler);

    expect(services.scheduler).toBe(scheduler);
  });

  it('flushes unsaved widgets with keepalive when the page is hidden', () => {
    const { services } = renderServices(api);
    services.scheduler.markSaved(ID, '');
    services.scheduler.schedule(ID, 'unsaved');

    setVisibility('hidden');

    expect(api.updateText).toHaveBeenCalledWith(ID, 'unsaved', { keepalive: true });
  });

  it('flushes unsaved widgets with keepalive on pagehide (tab close / reload)', () => {
    const { services } = renderServices(api);
    services.scheduler.markSaved(ID, '');
    services.scheduler.schedule(ID, 'unsaved');

    window.dispatchEvent(new Event('pagehide'));

    expect(api.updateText).toHaveBeenCalledWith(ID, 'unsaved', { keepalive: true });
  });

  it('does not flush when the page becomes visible', () => {
    const { services } = renderServices(api);
    services.scheduler.markSaved(ID, '');
    services.scheduler.schedule(ID, 'unsaved');

    setVisibility('visible');

    expect(api.updateText).not.toHaveBeenCalled();
  });

  it('stops listening and disposes the scheduler on unmount', async () => {
    const { services, unmount } = renderServices(api);
    services.scheduler.markSaved(ID, '');
    services.scheduler.schedule(ID, 'unsaved');

    unmount();
    window.dispatchEvent(new Event('pagehide'));
    setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(5_000);

    expect(api.updateText).not.toHaveBeenCalled();
  });

  it('throws a clear error when the scheduler is used outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    function Orphan() {
      useAutosaveScheduler();
      return null;
    }

    expect(() => render(<Orphan />)).toThrow(
      'useAutosaveScheduler must be used within a WidgetApiProvider',
    );
  });
});

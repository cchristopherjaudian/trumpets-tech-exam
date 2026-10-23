import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  createAutosaveScheduler,
  type AutosaveScheduler,
} from '../autosave/autosave-scheduler.js';
import type { WidgetApi } from './widget-api.js';

interface AppServices {
  api: WidgetApi;
  scheduler: AutosaveScheduler;
}

const ServicesContext = createContext<AppServices | null>(null);

export interface WidgetApiProviderProps {
  api: WidgetApi;
  /** Defaults to a scheduler that saves through `api.updateText`. */
  scheduler?: AutosaveScheduler;
  children: ReactNode;
}

/**
 * Provides the app-wide API client and autosave scheduler, and makes sure unsaved text is
 * flushed (with keepalive) when the page is hidden, reloaded or closed.
 */
export function WidgetApiProvider({ api, scheduler: injected, children }: WidgetApiProviderProps) {
  const [scheduler] = useState(
    () =>
      injected ??
      createAutosaveScheduler({ save: (id, text, options) => api.updateText(id, text, options) }),
  );
  const [services] = useState<AppServices>(() => ({ api, scheduler }));

  useEffect(() => {
    const flushAll = () => scheduler.flushAll({ keepalive: true });
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushAll();
    };

    window.addEventListener('pagehide', flushAll);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', flushAll);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      scheduler.dispose();
    };
  }, [scheduler]);

  return <ServicesContext value={services}>{children}</ServicesContext>;
}

function useServices(hookName: string): AppServices {
  const services = useContext(ServicesContext);
  if (!services) {
    throw new Error(`${hookName} must be used within a WidgetApiProvider`);
  }
  return services;
}

export const useWidgetApi = (): WidgetApi => useServices('useWidgetApi').api;

export const useAutosaveScheduler = (): AutosaveScheduler =>
  useServices('useAutosaveScheduler').scheduler;

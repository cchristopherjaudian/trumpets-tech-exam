import { createContext, useContext, type ReactNode } from 'react';
import type { WidgetApi } from './widget-api.js';

const WidgetApiContext = createContext<WidgetApi | null>(null);

export function WidgetApiProvider({ api, children }: { api: WidgetApi; children: ReactNode }) {
  return <WidgetApiContext value={api}>{children}</WidgetApiContext>;
}

export function useWidgetApi(): WidgetApi {
  const api = useContext(WidgetApiContext);
  if (!api) {
    throw new Error('useWidgetApi must be used within a WidgetApiProvider');
  }
  return api;
}

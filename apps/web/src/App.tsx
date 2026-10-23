import type { ReactNode } from 'react';
import { WidgetApiProvider } from './api/widget-api-context.js';
import { createWidgetApi, type WidgetApi } from './api/widget-api.js';

const defaultApi = createWidgetApi();

/** App-wide services: one API client and one autosave scheduler. */
export function AppProviders({ api = defaultApi, children }: { api?: WidgetApi; children: ReactNode }) {
  return <WidgetApiProvider api={api}>{children}</WidgetApiProvider>;
}

export function App({ api }: { api?: WidgetApi }) {
  return (
    <AppProviders {...(api && { api })}>
      <main className="app">
        <h1>Text widgets</h1>
      </main>
    </AppProviders>
  );
}

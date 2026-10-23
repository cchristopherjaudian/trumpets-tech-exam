import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App, AppProviders } from '../src/App.js';
import { useAutosaveScheduler, useWidgetApi } from '../src/api/widget-api-context.js';
import type { WidgetApi } from '../src/api/widget-api.js';

describe('App', () => {
  it('renders the widget board inside the main landmark and loads widgets', async () => {
    const api: WidgetApi = {
      list: vi.fn(async () => ({ ok: true as const, value: [] })),
      create: vi.fn(),
      updateText: vi.fn(),
      remove: vi.fn(),
    };

    render(<App api={api} />);

    const main = screen.getByRole('main');
    expect(within(main).getByRole('heading', { level: 1, name: 'Text widgets' })).toBeVisible();
    expect(await within(main).findByText(/No widgets yet/)).toBeInTheDocument();
    expect(within(main).getByRole('button', { name: 'Add widget' })).toBeEnabled();
    expect(api.list).toHaveBeenCalledTimes(1);
  });

  it('wraps the page in the app-wide API client and autosave scheduler', () => {
    let hasServices = false;
    function Probe() {
      hasServices = Boolean(useWidgetApi() && useAutosaveScheduler());
      return null;
    }

    render(
      <AppProviders>
        <Probe />
      </AppProviders>,
    );

    expect(hasServices).toBe(true);
  });

  it('runs in a DOM environment that supports user interaction', async () => {
    const user = userEvent.setup();
    render(<textarea aria-label="probe" />);

    await user.type(screen.getByRole('textbox', { name: 'probe' }), 'hi 🎺');

    expect(screen.getByRole('textbox', { name: 'probe' })).toHaveValue('hi 🎺');
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App, AppProviders } from '../src/App.js';
import { useAutosaveScheduler, useWidgetApi } from '../src/api/widget-api-context.js';

describe('App', () => {
  it('renders the pod page heading inside the main landmark', () => {
    render(<App />);

    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Text widgets' })).toBeVisible();
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

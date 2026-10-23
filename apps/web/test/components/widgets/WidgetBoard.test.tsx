import type { Widget } from '@text-widgets/shared';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Result } from '../../../src/api/result.js';
import { WidgetApiProvider } from '../../../src/api/widget-api-context.js';
import type { WidgetApi } from '../../../src/api/widget-api.js';
import { WidgetBoard } from '../../../src/components/widgets/WidgetBoard.js';

const widget = (id: string, text = ''): Widget => ({
  id,
  text,
  createdAt: '2026-10-23T00:00:00.000Z',
  updatedAt: '2026-10-23T00:00:00.000Z',
});

const ok = <T,>(value: T): Result<T> => ({ ok: true, value });
const networkError: Result<never> = { ok: false, error: { kind: 'network', message: 'offline' } };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('WidgetBoard', () => {
  let api: {
    list: ReturnType<typeof vi.fn<WidgetApi['list']>>;
    create: ReturnType<typeof vi.fn<WidgetApi['create']>>;
    updateText: ReturnType<typeof vi.fn<WidgetApi['updateText']>>;
    remove: ReturnType<typeof vi.fn<WidgetApi['remove']>>;
  };

  beforeEach(() => {
    api = {
      list: vi.fn(async () => ok<Widget[]>([])),
      create: vi.fn(),
      updateText: vi.fn(async (id, text) => ok(widget(id, text))),
      remove: vi.fn(async () => ok(undefined)),
    };
  });

  const renderBoard = () =>
    render(
      <WidgetApiProvider api={api}>
        <WidgetBoard />
      </WidgetApiProvider>,
    );

  const addButton = () => screen.getByRole('button', { name: 'Add widget' });

  it('shows the page heading and an "Add widget" button', async () => {
    renderBoard();

    expect(screen.getByRole('heading', { level: 1, name: 'Text widgets' })).toBeInTheDocument();
    await waitFor(() => expect(addButton()).toBeEnabled());
  });

  it('shows a loading indicator and disables adding until widgets are loaded', async () => {
    const pending = deferred<Result<Widget[]>>();
    api.list.mockReturnValueOnce(pending.promise);
    renderBoard();

    expect(screen.getByText('Loading widgets…')).toBeInTheDocument();
    expect(addButton()).toBeDisabled();

    await act(async () => pending.resolve(ok([])));
    expect(screen.queryByText('Loading widgets…')).not.toBeInTheDocument();
    expect(addButton()).toBeEnabled();
  });

  it('shows an error with a retry action when loading fails', async () => {
    api.list.mockResolvedValueOnce(networkError).mockResolvedValueOnce(ok([widget('a', 'back')]));
    renderBoard();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not load widgets.');

    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('textbox', { name: 'Text for widget 1' })).toHaveValue('back');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no widgets', async () => {
    renderBoard();

    expect(await screen.findByText(/No widgets yet/)).toBeInTheDocument();
  });

  it('renders stored widgets in order with their text', async () => {
    api.list.mockResolvedValueOnce(ok([widget('a', 'first'), widget('b', 'second')]));
    renderBoard();

    const regions = await screen.findAllByRole('region', { name: /^Text widget \d$/ });
    expect(regions.map((region) => region.getAttribute('class'))).toEqual(['widget-frame', 'widget-frame']);
    expect(screen.getAllByRole('textbox').map((box) => (box as HTMLTextAreaElement).value)).toEqual([
      'first',
      'second',
    ]);
    expect(screen.queryByText(/No widgets yet/)).not.toBeInTheDocument();
  });

  it('adds a widget per click and shows a pending indicator meanwhile', async () => {
    renderBoard();
    await screen.findByText(/No widgets yet/);
    const creation = deferred<Result<Widget>>();
    api.create.mockReturnValueOnce(creation.promise);

    await userEvent.click(addButton());
    expect(screen.getByText('Adding widget…')).toBeInTheDocument();
    expect(addButton()).toBeEnabled();

    await act(async () => creation.resolve(ok(widget('new'))));
    expect(screen.queryByText('Adding widget…')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Text widget 1' })).toBeInTheDocument();
    expect(screen.queryByText(/No widgets yet/)).not.toBeInTheDocument();
  });

  it('shows a dismissible notice when adding fails', async () => {
    renderBoard();
    await screen.findByText(/No widgets yet/);
    api.create.mockResolvedValueOnce(networkError);

    await userEvent.click(addButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not add a widget.');
    await userEvent.click(within(alert).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('removes a widget via its delete button and shows a notice if deletion fails', async () => {
    api.list.mockResolvedValueOnce(ok([widget('a', 'keep'), widget('b', 'doomed')]));
    api.remove.mockResolvedValueOnce(networkError);
    renderBoard();

    await userEvent.click(await screen.findByRole('button', { name: 'Delete widget 2' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete the widget.');
    expect(screen.getAllByRole('textbox').map((box) => (box as HTMLTextAreaElement).value)).toEqual([
      'keep',
      'doomed',
    ]);
  });
});

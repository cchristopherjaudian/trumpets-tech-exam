import type { Widget } from '@text-widgets/shared';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App.js';
import { useAutosave } from '../../src/hooks/use-autosave.js';
import { createInMemoryApi } from '../support/in-memory-api.js';

// Pass-through spy used to count widget renders (one useAutosave call per TextWidget render).
vi.mock('../../src/hooks/use-autosave.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/hooks/use-autosave.js')>();
  return { ...original, useAutosave: vi.fn(original.useAutosave) };
});

const widget = (id: string, text = ''): Widget => ({
  id,
  text,
  createdAt: '2026-10-23T00:00:00.000Z',
  updatedAt: '2026-10-23T00:00:00.000Z',
});

const textboxes = () => screen.queryAllByRole('textbox') as HTMLTextAreaElement[];
const values = () => textboxes().map((box) => box.value);

describe('Widget board user flows', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(useAutosave).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const user = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

  /** Renders the full app and waits for the initial load to settle. */
  const renderApp = async (server: ReturnType<typeof createInMemoryApi>) => {
    const utils = render(<App api={server.api} />);
    await settle();
    return utils;
  };

  const idle = () => act(() => vi.advanceTimersByTimeAsync(800));
  /** Lets pending API responses resolve and their state updates render. */
  const settle = () => act(() => vi.advanceTimersByTimeAsync(0));

  describe('adding widgets', () => {
    it('adds one bordered widget per click, in order, replacing the empty state', async () => {
      const server = createInMemoryApi();
      await renderApp(server);
      expect(screen.getByText(/No widgets yet/)).toBeInTheDocument();

      for (let i = 0; i < 3; i += 1) {
        await user().click(screen.getByRole('button', { name: 'Add widget' }));
      }
      await settle();

      const regions = screen.getAllByRole('region', { name: /^Text widget/ });
      expect(regions.map((region) => within(region).getByRole('heading').textContent)).toEqual([
        'Text widget 1',
        'Text widget 2',
        'Text widget 3',
      ]);
      regions.forEach((region) => expect(region).toHaveClass('widget-frame'));
      expect(screen.queryByText(/No widgets yet/)).not.toBeInTheDocument();
      expect(server.api.create).toHaveBeenCalledTimes(3);
      expect(server.stored()).toHaveLength(3);
    });
  });

  describe('editing and saving', () => {
    it('keeps widgets independent and saves only the edited one after the idle period', async () => {
      const server = createInMemoryApi([widget('a', 'alpha'), widget('b', 'beta'), widget('c', 'gamma')]);
      await renderApp(server);

      await user().type(textboxes()[1]!, ' edited');
      expect(server.api.updateText).not.toHaveBeenCalled();
      await idle();

      expect(values()).toEqual(['alpha', 'beta edited', 'gamma']);
      expect(server.api.updateText).toHaveBeenCalledTimes(1);
      expect(server.api.updateText).toHaveBeenCalledWith('b', 'beta edited', { keepalive: false });
      expect(server.stored()).toEqual([
        { id: 'a', text: 'alpha' },
        { id: 'b', text: 'beta edited' },
        { id: 'c', text: 'gamma' },
      ]);
    });

    it('saves once immediately on blur and not again after the idle period', async () => {
      const server = createInMemoryApi([widget('a'), widget('b')]);
      await renderApp(server);

      await user().type(textboxes()[0]!, 'quick note');
      await user().click(textboxes()[1]!);
      expect(server.api.updateText).toHaveBeenCalledTimes(1);
      expect(server.api.updateText).toHaveBeenCalledWith('a', 'quick note', { keepalive: false });

      await idle();
      expect(server.api.updateText).toHaveBeenCalledTimes(1);
    });

    it('restores exactly what was typed after a reload', async () => {
      const server = createInMemoryApi();
      const first = await renderApp(server);
      await user().click(screen.getByRole('button', { name: 'Add widget' }));
      await user().click(screen.getByRole('button', { name: 'Add widget' }));
      await settle();
      await user().type(textboxes()[0]!, 'first widget{Enter}  indented');
      await user().type(textboxes()[1]!, 'second 🎺');
      await idle();

      first.unmount();
      await renderApp(server);

      expect(values()).toEqual(['first widget\n  indented', 'second 🎺']);
    });
  });

  describe('restoring on load', () => {
    it('renders stored widgets, including 1,000-character text, exactly and in order', async () => {
      const long = 'The quick brown fox 🦊 jumps.\n'.repeat(40).slice(0, 1_000);
      expect(long).toHaveLength(1_000);
      const server = createInMemoryApi([widget('a', long), widget('b', 'short'), widget('c', '')]);

      await renderApp(server);

      expect(values()).toEqual([long, 'short', '']);
      expect(screen.getByText('1,000 / 50,000')).toBeInTheDocument();
    });

    it('shows loading, then an error with retry, then the widgets', async () => {
      const server = createInMemoryApi([widget('a', 'recovered')]);
      server.failNext('list');
      render(<App api={server.api} />);
      expect(screen.getByText('Loading widgets…')).toBeInTheDocument();

      await settle();
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Could not load widgets.');

      await user().click(within(alert).getByRole('button', { name: 'Retry' }));
      await settle();

      expect(values()).toEqual(['recovered']);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('deleting widgets', () => {
    it('removes only the deleted widget and leaves the others untouched', async () => {
      const server = createInMemoryApi([widget('a', 'one'), widget('b', 'two'), widget('c', 'three')]);
      await renderApp(server);

      await user().click(screen.getByRole('button', { name: 'Delete widget 2' }));

      expect(values()).toEqual(['one', 'three']);
      expect(server.stored()).toEqual([
        { id: 'a', text: 'one' },
        { id: 'c', text: 'three' },
      ]);
    });

    it('restores a widget in place with its latest text when deletion fails', async () => {
      const server = createInMemoryApi([widget('a', 'one'), widget('b', 'two'), widget('c', 'three')]);
      await renderApp(server);
      server.failNext('remove');

      await user().click(screen.getByRole('button', { name: 'Delete widget 2' }));
      expect(values()).toEqual(['one', 'three']);
      await settle();

      expect(screen.getByRole('alert')).toHaveTextContent('Could not delete the widget.');
      expect(values()).toEqual(['one', 'two', 'three']);
      expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
        'Text widget 1',
        'Text widget 2',
        'Text widget 3',
      ]);
    });

    it('never sends a save for a widget after it is deleted', async () => {
      const server = createInMemoryApi([widget('a', ''), widget('b', 'keep')]);
      await renderApp(server);

      await user().type(textboxes()[0]!, 'typed then deleted');
      // Clicking Delete blurs the textbox first, which flushes the save before the delete.
      await user().click(screen.getByRole('button', { name: 'Delete widget 1' }));
      await act(() => vi.advanceTimersByTimeAsync(5_000));

      const savesForA = server.api.updateText.mock.invocationCallOrder.filter(
        (_order, call) => server.api.updateText.mock.calls[call]?.[0] === 'a',
      );
      const deleteOrder = server.api.remove.mock.invocationCallOrder[0]!;
      expect(savesForA.every((order) => order < deleteOrder)).toBe(true);
      expect(values()).toEqual(['keep']);
      expect(server.stored()).toEqual([{ id: 'b', text: 'keep' }]);
    });
  });

  describe('performance with many large widgets', () => {
    it('re-renders only the widget being typed in', async () => {
      const big = 'x'.repeat(10_000);
      const server = createInMemoryApi(
        Array.from({ length: 50 }, (_, index) => widget(`w${index}`, big)),
      );
      await renderApp(server);
      expect(textboxes()).toHaveLength(50);
      vi.mocked(useAutosave).mockClear();

      fireEvent.change(textboxes()[25]!, { target: { value: `${big}y` } });
      fireEvent.change(textboxes()[25]!, { target: { value: `${big}yz` } });

      const renderedIds = new Set(vi.mocked(useAutosave).mock.calls.map(([id]) => id));
      expect([...renderedIds]).toEqual(['w25']);
      expect(textboxes()[24]!.value).toBe(big);
      await idle();
      expect(server.api.updateText).toHaveBeenCalledTimes(1);
      expect(server.api.updateText).toHaveBeenCalledWith('w25', `${big}yz`, { keepalive: false });
    });
  });
});

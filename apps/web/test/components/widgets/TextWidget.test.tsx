import type { Widget } from '@text-widgets/shared';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Result } from '../../../src/api/result.js';
import { WidgetApiProvider } from '../../../src/api/widget-api-context.js';
import type { WidgetApi } from '../../../src/api/widget-api.js';
import {
  createAutosaveScheduler,
  type AutosaveScheduler,
} from '../../../src/autosave/autosave-scheduler.js';
import { TextWidget } from '../../../src/components/widgets/TextWidget.js';
import { useAutosave } from '../../../src/hooks/use-autosave.js';

// Pass-through spy: TextWidget calls useAutosave exactly once per render, so the calls
// for a widget id count how many times that widget actually rendered.
vi.mock('../../../src/hooks/use-autosave.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/hooks/use-autosave.js')>();
  return { ...original, useAutosave: vi.fn(original.useAutosave) };
});

const renderCount = (id: string) =>
  vi.mocked(useAutosave).mock.calls.filter(([widgetId]) => widgetId === id).length;

const widget = (id: string, text = ''): Widget => ({
  id,
  text,
  createdAt: '2026-10-23T00:00:00.000Z',
  updatedAt: '2026-10-23T00:00:00.000Z',
});

const ok = (value: Widget): Result<Widget> => ({ ok: true, value });
const failed: Result<Widget> = { ok: false, error: { kind: 'network', message: 'Failed to fetch' } };

describe('TextWidget', () => {
  let updateText: ReturnType<typeof vi.fn<WidgetApi['updateText']>>;
  let scheduler: AutosaveScheduler;
  let api: WidgetApi;

  beforeEach(() => {
    vi.mocked(useAutosave).mockClear();
    vi.useFakeTimers();
    updateText = vi.fn<WidgetApi['updateText']>(async (id, text) => ok(widget(id, text)));
    api = { list: vi.fn(), create: vi.fn(), remove: vi.fn(), updateText };
    scheduler = createAutosaveScheduler({ save: updateText });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const user = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

  const renderWithServices = (ui: ReactNode) =>
    render(
      <WidgetApiProvider api={api} scheduler={scheduler}>
        {ui}
      </WidgetApiProvider>,
    );

  /** Mounts a widget the way the board does: baseline registered first. */
  const renderWidget = (value: Widget, index = 0, onDelete = vi.fn()) => {
    scheduler.markSaved(value.id, value.text);
    renderWithServices(<TextWidget widget={value} index={index} onDelete={onDelete} />);
    return { onDelete, region: screen.getByRole('region', { name: `Text widget ${index + 1}` }) };
  };

  it('renders a bordered, titled widget with its stored text', () => {
    const { region } = renderWidget(widget('a', 'stored text'), 1);

    expect(region).toHaveClass('widget-frame');
    expect(within(region).getByRole('textbox', { name: 'Text for widget 2' })).toHaveValue(
      'stored text',
    );
    expect(within(region).getByRole('status')).toHaveTextContent('Saved');
    expect(within(region).getByText('11 / 50,000')).toBeInTheDocument();
  });

  it('saves the full text once the user stops typing for 800 ms', async () => {
    renderWidget(widget('a'));
    const textbox = screen.getByRole('textbox');

    await user().type(textbox, 'Hello');
    expect(screen.getByRole('status')).toHaveTextContent('Unsaved changes');
    expect(updateText).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(800));

    expect(updateText).toHaveBeenCalledTimes(1);
    expect(updateText).toHaveBeenCalledWith('a', 'Hello', { keepalive: false });
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
  });

  it('saves immediately when the textbox loses focus', async () => {
    renderWidget(widget('a'));

    await user().type(screen.getByRole('textbox'), 'done');
    await user().tab();

    expect(updateText).toHaveBeenCalledWith('a', 'done', { keepalive: false });
  });

  it('shows the saving state while the request is in flight', async () => {
    let resolveSave: (result: Result<Widget>) => void = () => {};
    updateText.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveSave = resolve;
      }),
    );
    renderWidget(widget('a'));

    await user().type(screen.getByRole('textbox'), 'x');
    await user().tab();
    expect(screen.getByRole('status')).toHaveTextContent('Saving…');

    await act(async () => resolveSave(ok(widget('a', 'x'))));
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
  });

  it('shows an error with a retry action that re-sends the kept text', async () => {
    updateText.mockResolvedValueOnce(failed);
    renderWidget(widget('a'));

    await user().type(screen.getByRole('textbox'), 'precious');
    await user().tab();
    expect(screen.getByRole('status')).toHaveTextContent('Save failed');
    expect(screen.getByRole('textbox')).toHaveValue('precious');

    await user().click(screen.getByRole('button', { name: 'Retry save' }));

    expect(updateText).toHaveBeenLastCalledWith('a', 'precious', { keepalive: false });
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    expect(screen.queryByRole('button', { name: 'Retry save' })).not.toBeInTheDocument();
  });

  it('preserves whitespace and line breaks in what it saves', async () => {
    renderWidget(widget('a'));

    await user().type(screen.getByRole('textbox'), '  two{Enter}{Enter}lines  ');
    await user().tab();

    expect(updateText).toHaveBeenCalledWith('a', '  two\n\nlines  ', { keepalive: false });
  });

  it('handles pasting 10,000 characters as a single save', async () => {
    renderWidget(widget('a'));
    const text = 'z'.repeat(10_000);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: text } });
    await act(() => vi.advanceTimersByTimeAsync(800));

    expect(updateText).toHaveBeenCalledTimes(1);
    expect(updateText.mock.calls[0]?.[1]).toHaveLength(10_000);
  });

  it('calls onDelete with its id from an accessibly labelled delete button', async () => {
    const { onDelete } = renderWidget(widget('a'), 2);

    await user().click(screen.getByRole('button', { name: 'Delete widget 3' }));

    expect(onDelete).toHaveBeenCalledWith('a');
  });

  describe('independence and rendering cost', () => {
    const renderPair = () => {
      const onDelete = vi.fn();
      scheduler.markSaved('a', 'alpha');
      scheduler.markSaved('b', 'beta');
      const widgets = [widget('a', 'alpha'), widget('b', 'beta')] as const;
      // Builds fresh elements on every call, so a re-render only bails out if TextWidget is memoised.
      const makeView = () => (
        <WidgetApiProvider api={api} scheduler={scheduler}>
          {widgets.map((value, index) => (
            <TextWidget key={value.id} widget={value} index={index} onDelete={onDelete} />
          ))}
        </WidgetApiProvider>
      );
      const utils = render(makeView());
      return { rerenderSame: () => utils.rerender(makeView()) };
    };

    it('keeps text independent and saves only the edited widget', async () => {
      renderPair();
      const [first, second] = screen.getAllByRole('textbox');

      await user().type(first!, '!');
      await user().tab();

      expect(first).toHaveValue('alpha!');
      expect(second).toHaveValue('beta');
      expect(updateText).toHaveBeenCalledTimes(1);
      expect(updateText).toHaveBeenCalledWith('a', 'alpha!', { keepalive: false });
    });

    it('does not re-render a widget when a sibling is edited', async () => {
      renderPair();
      const before = { a: renderCount('a'), b: renderCount('b') };

      await user().type(screen.getAllByRole('textbox')[0]!, 'abc');

      expect(renderCount('a')).toBeGreaterThan(before.a);
      expect(renderCount('b')).toBe(before.b);
    });

    it('does not re-render when its parent re-renders with the same props', () => {
      const { rerenderSame } = renderPair();
      const before = { a: renderCount('a'), b: renderCount('b') };

      rerenderSame();

      expect({ a: renderCount('a'), b: renderCount('b') }).toEqual(before);
    });
  });
});

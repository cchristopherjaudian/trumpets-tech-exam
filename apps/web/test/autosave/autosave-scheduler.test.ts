import type { Widget } from '@text-widgets/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Result } from '../../src/api/result.js';
import {
  createAutosaveScheduler,
  DEFAULT_AUTOSAVE_DELAY_MS,
  type AutosaveScheduler,
} from '../../src/autosave/autosave-scheduler.js';
import type { SaveStatus } from '../../src/autosave/save-status.js';

type SaveResult = Result<Widget>;

interface PendingSave {
  id: string;
  text: string;
  keepalive: boolean;
  resolve: (result: SaveResult) => void;
}

const widgetFor = (id: string, text: string): Widget => ({
  id,
  text,
  createdAt: '2026-10-23T00:00:00.000Z',
  updatedAt: '2026-10-23T00:00:00.000Z',
});

const success = (save: PendingSave): SaveResult => ({ ok: true, value: widgetFor(save.id, save.text) });
const failure: SaveResult = {
  ok: false,
  error: { kind: 'network', message: 'Failed to fetch' },
};

describe('AutosaveScheduler', () => {
  let saves: PendingSave[];
  let save: ReturnType<typeof vi.fn<(id: string, text: string, opts: { keepalive: boolean }) => Promise<SaveResult>>>;
  let scheduler: AutosaveScheduler;

  /** Lets awaited promise chains inside the scheduler settle. */
  const settle = () => vi.advanceTimersByTimeAsync(0);

  const resolveSave = async (index: number, result?: SaveResult) => {
    const pending = saves[index];
    if (!pending) throw new Error(`No save #${index}`);
    pending.resolve(result ?? success(pending));
    await settle();
  };

  const sentTexts = () => saves.map((entry) => entry.text);

  beforeEach(() => {
    vi.useFakeTimers();
    saves = [];
    save = vi.fn((id: string, text: string, { keepalive }: { keepalive: boolean }) =>
      new Promise<SaveResult>((resolve) => {
        saves.push({ id, text, keepalive, resolve });
      }),
    );
    scheduler = createAutosaveScheduler({ save });
    scheduler.markSaved('a', '');
  });

  afterEach(() => {
    scheduler.dispose();
    vi.useRealTimers();
  });

  it('uses an 800 ms idle delay by default', () => {
    expect(DEFAULT_AUTOSAVE_DELAY_MS).toBe(800);
  });

  describe('done-typing detection', () => {
    it('does not save while the user keeps typing', async () => {
      for (const text of ['h', 'he', 'hel', 'hell', 'hello']) {
        scheduler.schedule('a', text);
        await vi.advanceTimersByTimeAsync(500);
      }

      expect(save).not.toHaveBeenCalled();
      expect(scheduler.getStatus('a')).toBe('pending');
    });

    it('saves the latest text exactly once after 800 ms of inactivity', async () => {
      scheduler.schedule('a', 'h');
      scheduler.schedule('a', 'hi');
      await vi.advanceTimersByTimeAsync(799);
      expect(save).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);

      expect(save).toHaveBeenCalledTimes(1);
      expect(save).toHaveBeenCalledWith('a', 'hi', { keepalive: false });
    });

    it('respects a custom delay', async () => {
      scheduler.dispose();
      scheduler = createAutosaveScheduler({ save, delayMs: 200 });
      scheduler.schedule('a', 'x');

      await vi.advanceTimersByTimeAsync(200);

      expect(save).toHaveBeenCalledTimes(1);
    });

    it('saves immediately on flush without waiting for the delay', async () => {
      scheduler.schedule('a', 'typed');

      const flushed = scheduler.flush('a');
      expect(save).toHaveBeenCalledWith('a', 'typed', { keepalive: false });
      await resolveSave(0);
      await flushed;

      expect(scheduler.getStatus('a')).toBe('saved');
      await vi.advanceTimersByTimeAsync(5_000);
      expect(save).toHaveBeenCalledTimes(1);
    });
  });

  describe('skipping unchanged text', () => {
    it('does not save when the text equals the last saved text', async () => {
      scheduler.markSaved('a', 'stored');
      scheduler.schedule('a', 'stored');
      await vi.advanceTimersByTimeAsync(1_000);
      await scheduler.flush('a');

      expect(save).not.toHaveBeenCalled();
      expect(scheduler.getStatus('a')).toBe('saved');
    });

    it('returns to saved and cancels the pending save when edits are reverted', async () => {
      scheduler.markSaved('a', 'stored');
      scheduler.schedule('a', 'stored!');
      expect(scheduler.getStatus('a')).toBe('pending');

      scheduler.schedule('a', 'stored');
      await vi.advanceTimersByTimeAsync(1_000);

      expect(scheduler.getStatus('a')).toBe('saved');
      expect(save).not.toHaveBeenCalled();
    });

    it('does not save again after a successful save of the same text', async () => {
      scheduler.schedule('a', 'once');
      await vi.advanceTimersByTimeAsync(800);
      await resolveSave(0);

      scheduler.schedule('a', 'once');
      await scheduler.flush('a');

      expect(save).toHaveBeenCalledTimes(1);
    });
  });

  describe('per-widget isolation', () => {
    it('saves only the widget that changed, with its own text and timer', async () => {
      scheduler.markSaved('b', 'b-original');
      scheduler.schedule('a', 'a-text');
      await vi.advanceTimersByTimeAsync(400);
      scheduler.schedule('b', 'b-text');
      await vi.advanceTimersByTimeAsync(400);

      expect(saves.map(({ id, text }) => [id, text])).toEqual([['a', 'a-text']]);
      expect(scheduler.getStatus('b')).toBe('pending');

      await vi.advanceTimersByTimeAsync(400);
      expect(saves.map(({ id, text }) => [id, text])).toEqual([
        ['a', 'a-text'],
        ['b', 'b-text'],
      ]);
    });
  });

  describe('in-flight coalescing (latest text wins)', () => {
    it('never has more than one save in flight per widget', async () => {
      scheduler.schedule('a', 'one');
      void scheduler.flush('a');
      scheduler.schedule('a', 'two');
      void scheduler.flush('a');
      scheduler.schedule('a', 'three');
      void scheduler.flush('a');

      expect(sentTexts()).toEqual(['one']);
    });

    it('sends one follow-up with the newest text when a save was requested mid-flight', async () => {
      scheduler.schedule('a', 'one');
      const first = scheduler.flush('a');
      scheduler.schedule('a', 'two');
      void scheduler.flush('a');
      scheduler.schedule('a', 'three');
      const last = scheduler.flush('a');

      await resolveSave(0);
      expect(sentTexts()).toEqual(['one', 'three']);
      expect(scheduler.getStatus('a')).toBe('saving');

      await resolveSave(1);
      await Promise.all([first, last]);
      expect(scheduler.getStatus('a')).toBe('saved');
      expect(save).toHaveBeenCalledTimes(2);
    });

    it('waits for the idle delay before saving text typed during a save', async () => {
      scheduler.schedule('a', 'one');
      void scheduler.flush('a');
      scheduler.schedule('a', 'one more');

      await resolveSave(0);
      expect(sentTexts()).toEqual(['one']);
      expect(scheduler.getStatus('a')).toBe('pending');

      await vi.advanceTimersByTimeAsync(800);
      expect(sentTexts()).toEqual(['one', 'one more']);
    });

    it('queues a follow-up when the idle timer fires during a save', async () => {
      scheduler.schedule('a', 'one');
      void scheduler.flush('a');
      scheduler.schedule('a', 'two');
      await vi.advanceTimersByTimeAsync(800);
      expect(sentTexts()).toEqual(['one']);

      await resolveSave(0);

      expect(sentTexts()).toEqual(['one', 'two']);
    });

    it('skips the follow-up when the text was reverted to what was just saved', async () => {
      scheduler.schedule('a', 'one');
      void scheduler.flush('a');
      scheduler.schedule('a', 'two');
      void scheduler.flush('a');
      scheduler.schedule('a', 'one');

      await resolveSave(0);

      expect(sentTexts()).toEqual(['one']);
      expect(scheduler.getStatus('a')).toBe('saved');
    });
  });

  describe('failures and retry', () => {
    it('marks the widget as error and keeps the draft when a save fails', async () => {
      scheduler.schedule('a', 'important');
      void scheduler.flush('a');

      await resolveSave(0, failure);

      expect(scheduler.getStatus('a')).toBe('error');
      await vi.advanceTimersByTimeAsync(5_000);
      expect(save).toHaveBeenCalledTimes(1);
    });

    it('retries the kept draft on flush', async () => {
      scheduler.schedule('a', 'important');
      void scheduler.flush('a');
      await resolveSave(0, failure);

      const retried = scheduler.flush('a');
      expect(sentTexts()).toEqual(['important', 'important']);
      await resolveSave(1);
      await retried;

      expect(scheduler.getStatus('a')).toBe('saved');
    });

    it('retries with the newest text when the user keeps typing after an error', async () => {
      scheduler.schedule('a', 'v1');
      void scheduler.flush('a');
      await resolveSave(0, failure);

      scheduler.schedule('a', 'v2');
      expect(scheduler.getStatus('a')).toBe('pending');
      await vi.advanceTimersByTimeAsync(800);

      expect(sentTexts()).toEqual(['v1', 'v2']);
    });

    it('treats a rejected save promise as a failure instead of crashing', async () => {
      save.mockRejectedValueOnce(new Error('unexpected'));
      scheduler.schedule('a', 'x');

      await scheduler.flush('a');

      expect(scheduler.getStatus('a')).toBe('error');
    });
  });

  describe('flushAll (page hide)', () => {
    it('immediately saves every dirty widget with keepalive and skips clean ones', async () => {
      scheduler.markSaved('b', 'clean');
      scheduler.markSaved('c', '');
      scheduler.schedule('a', 'dirty a');
      scheduler.schedule('c', 'dirty c');

      scheduler.flushAll({ keepalive: true });

      expect(saves.map(({ id, text, keepalive }) => [id, text, keepalive])).toEqual([
        ['a', 'dirty a', true],
        ['c', 'dirty c', true],
      ]);
    });

    it('uses keepalive for a follow-up queued behind an in-flight save', async () => {
      scheduler.schedule('a', 'one');
      void scheduler.flush('a');
      scheduler.schedule('a', 'two');

      scheduler.flushAll({ keepalive: true });
      await resolveSave(0);

      expect(saves[1]).toMatchObject({ text: 'two', keepalive: true });
    });
  });

  describe('cancel (widget deleted)', () => {
    it('drops a pending save so it is never sent', async () => {
      scheduler.schedule('a', 'about to be deleted');

      scheduler.cancel('a');
      await vi.advanceTimersByTimeAsync(5_000);
      scheduler.flushAll();

      expect(save).not.toHaveBeenCalled();
    });

    it('ignores the late response of a save that was in flight when cancelled', async () => {
      const statuses: SaveStatus[] = [];
      scheduler.subscribe('a', (status) => statuses.push(status));
      scheduler.schedule('a', 'one');
      void scheduler.flush('a');
      scheduler.schedule('a', 'two');
      void scheduler.flush('a');

      scheduler.cancel('a');
      await resolveSave(0);

      expect(sentTexts()).toEqual(['one']);
      expect(statuses).toEqual(['pending', 'saving']);
    });
  });

  describe('status subscriptions', () => {
    it('notifies listeners of each status transition', async () => {
      const statuses: SaveStatus[] = [];
      scheduler.subscribe('a', (status) => statuses.push(status));

      scheduler.schedule('a', 'h');
      scheduler.schedule('a', 'hi');
      await vi.advanceTimersByTimeAsync(800);
      await resolveSave(0);

      expect(statuses).toEqual(['pending', 'saving', 'saved']);
    });

    it('stops notifying after unsubscribe and only notifies listeners of that widget', () => {
      const listenerA = vi.fn();
      const listenerB = vi.fn();
      const unsubscribe = scheduler.subscribe('a', listenerA);
      scheduler.subscribe('b', listenerB);

      unsubscribe();
      scheduler.schedule('a', 'x');

      expect(listenerA).not.toHaveBeenCalled();
      expect(listenerB).not.toHaveBeenCalled();
    });

    it('reports saved for widgets it has never seen', () => {
      expect(scheduler.getStatus('unknown')).toBe('saved');
    });
  });

  describe('dispose', () => {
    it('clears pending timers so nothing is saved afterwards', async () => {
      scheduler.schedule('a', 'x');

      scheduler.dispose();
      await vi.advanceTimersByTimeAsync(5_000);

      expect(save).not.toHaveBeenCalled();
    });
  });
});

import type { Widget, WidgetId } from '@text-widgets/shared';
import type { Result } from '../api/result.js';
import type { SaveStatus } from './save-status.js';

export const DEFAULT_AUTOSAVE_DELAY_MS = 800;

export type SaveFn = (
  id: WidgetId,
  text: string,
  options: { keepalive: boolean },
) => Promise<Result<Widget>>;

export type Unsubscribe = () => void;

export interface AutosaveScheduler {
  /** Records `text` as the stored baseline (after load or create). */
  markSaved(id: WidgetId, text: string): void;
  /** Records a new draft and restarts the idle timer. */
  schedule(id: WidgetId, text: string): void;
  /** Saves now if the draft differs from the stored text. Resolves once settled. */
  flush(id: WidgetId): Promise<void>;
  /** Saves every dirty widget now, e.g. when the page is being hidden. */
  flushAll(options?: { keepalive?: boolean }): void;
  /** Forgets a widget: drops its timer and ignores any in-flight response. */
  cancel(id: WidgetId): void;
  getStatus(id: WidgetId): SaveStatus;
  subscribe(id: WidgetId, listener: (status: SaveStatus) => void): Unsubscribe;
  dispose(): void;
}

interface Entry {
  lastSaved: string;
  draft: string;
  status: SaveStatus;
  timer: ReturnType<typeof setTimeout> | undefined;
  /** The running save loop, if a save is in flight. */
  inFlight: Promise<void> | undefined;
  /** A save was requested while another was in flight. */
  followUp: boolean;
  keepalive: boolean;
}

/**
 * Decides when and what to save for each widget, independently of React.
 *
 * - Saves after `delayMs` of inactivity, or immediately on flush.
 * - Never saves text equal to the last saved text.
 * - Keeps at most one save in flight per widget; save requests made meanwhile collapse
 *   into one follow-up carrying the newest draft, so the last typed text is always the
 *   value finally stored.
 */
export function createAutosaveScheduler({
  save,
  delayMs = DEFAULT_AUTOSAVE_DELAY_MS,
}: {
  save: SaveFn;
  delayMs?: number;
}): AutosaveScheduler {
  const entries = new Map<WidgetId, Entry>();
  const listeners = new Map<WidgetId, Set<(status: SaveStatus) => void>>();

  const createEntry = (id: WidgetId, text: string): Entry => {
    const entry: Entry = {
      lastSaved: text,
      draft: text,
      status: 'saved',
      timer: undefined,
      inFlight: undefined,
      followUp: false,
      keepalive: false,
    };
    entries.set(id, entry);
    return entry;
  };

  const setStatus = (id: WidgetId, entry: Entry, status: SaveStatus) => {
    if (entry.status === status) return;
    entry.status = status;
    listeners.get(id)?.forEach((listener) => listener(status));
  };

  const clearTimer = (entry: Entry) => {
    clearTimeout(entry.timer);
    entry.timer = undefined;
  };

  const isDirty = (entry: Entry) => entry.draft !== entry.lastSaved;

  async function runSaveLoop(id: WidgetId, entry: Entry): Promise<void> {
    do {
      entry.followUp = false;
      const snapshot = entry.draft;
      const keepalive = entry.keepalive;
      entry.keepalive = false;
      setStatus(id, entry, 'saving');

      const result = await save(id, snapshot, { keepalive }).catch(
        (): Result<Widget> => ({ ok: false, error: { kind: 'network', message: 'Save failed' } }),
      );
      if (entries.get(id) !== entry) return; // cancelled while in flight

      if (!result.ok) {
        setStatus(id, entry, 'error');
        return;
      }
      entry.lastSaved = snapshot;
    } while (entry.followUp && isDirty(entry));

    setStatus(id, entry, isDirty(entry) ? 'pending' : 'saved');
  }

  function requestSave(id: WidgetId, keepalive = false): Promise<void> {
    const entry = entries.get(id);
    if (!entry) return Promise.resolve();
    clearTimer(entry);
    entry.keepalive ||= keepalive;

    if (entry.inFlight) {
      entry.followUp = true;
      return entry.inFlight;
    }
    if (!isDirty(entry)) {
      entry.keepalive = false;
      setStatus(id, entry, 'saved');
      return Promise.resolve();
    }

    const loop = runSaveLoop(id, entry).finally(() => {
      entry.inFlight = undefined;
    });
    entry.inFlight = loop;
    return loop;
  }

  return {
    markSaved(id, text) {
      const existing = entries.get(id);
      if (existing) clearTimer(existing);
      const entry = createEntry(id, text);
      if (existing && existing.status !== entry.status) {
        listeners.get(id)?.forEach((listener) => listener(entry.status));
      }
    },

    schedule(id, text) {
      const entry = entries.get(id) ?? createEntry(id, '');
      entry.draft = text;
      clearTimer(entry);
      if (entry.inFlight) {
        // The loop settles the status; just make sure a newer draft gets saved eventually.
        if (isDirty(entry)) entry.timer = setTimeout(() => void requestSave(id), delayMs);
        return;
      }
      if (!isDirty(entry)) {
        setStatus(id, entry, 'saved');
        return;
      }
      setStatus(id, entry, 'pending');
      entry.timer = setTimeout(() => void requestSave(id), delayMs);
    },

    flush: (id) => requestSave(id),

    flushAll({ keepalive = false } = {}) {
      for (const [id, entry] of entries) {
        if (isDirty(entry)) void requestSave(id, keepalive);
      }
    },

    cancel(id) {
      const entry = entries.get(id);
      if (!entry) return;
      clearTimer(entry);
      entries.delete(id);
    },

    getStatus: (id) => entries.get(id)?.status ?? 'saved',

    subscribe(id, listener) {
      const set = listeners.get(id) ?? new Set();
      set.add(listener);
      listeners.set(id, set);
      return () => {
        set.delete(listener);
        if (set.size === 0) listeners.delete(id);
      };
    },

    dispose() {
      entries.forEach(clearTimer);
      entries.clear();
      listeners.clear();
    },
  };
}

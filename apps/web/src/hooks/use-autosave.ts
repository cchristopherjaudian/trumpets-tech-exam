import type { WidgetId } from '@text-widgets/shared';
import { useCallback, useState, useSyncExternalStore } from 'react';
import { useAutosaveScheduler } from '../api/widget-api-context.js';
import type { SaveStatus } from '../autosave/save-status.js';

export interface UseAutosave {
  text: string;
  setText: (next: string) => void;
  /** Save now, e.g. on blur. */
  flush: () => void;
  retry: () => void;
  status: SaveStatus;
}

/**
 * Binds one widget's local draft to the shared autosave scheduler. The draft lives here,
 * not in board state, so a keystroke only re-renders the widget being edited.
 */
export function useAutosave(id: WidgetId, initialText: string): UseAutosave {
  const scheduler = useAutosaveScheduler();
  const [text, setLocalText] = useState(initialText);

  const status = useSyncExternalStore(
    useCallback((onChange: () => void) => scheduler.subscribe(id, onChange), [scheduler, id]),
    () => scheduler.getStatus(id),
  );

  const setText = useCallback(
    (next: string) => {
      setLocalText(next);
      scheduler.schedule(id, next);
    },
    [scheduler, id],
  );

  const flush = useCallback(() => {
    void scheduler.flush(id);
  }, [scheduler, id]);

  return { text, setText, flush, retry: flush, status };
}

import type { WidgetId } from '@text-widgets/shared';
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { useAutosaveScheduler, useWidgetApi } from '../api/widget-api-context.js';
import {
  initialWidgetsState,
  toBoardState,
  widgetsReducer,
  type BoardState,
} from './widgets-reducer.js';

export const MESSAGES = {
  loadFailed: 'Could not load widgets. Check your connection and try again.',
  createFailed: 'Could not add a widget. Please try again.',
  deleteFailed: 'Could not delete the widget. Please try again.',
} as const;

export interface UseWidgets {
  state: BoardState;
  reload: () => void;
  addWidget: () => Promise<void>;
  deleteWidget: (id: WidgetId) => Promise<void>;
  dismissNotice: () => void;
}

/** Board-level state: loading the widget list, adding widgets and deleting them. */
export function useWidgets(): UseWidgets {
  const api = useWidgetApi();
  const scheduler = useAutosaveScheduler();
  const [state, dispatch] = useReducer(widgetsReducer, initialWidgetsState);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void api.list(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (!result.ok) {
        dispatch({ type: 'LOAD_FAILED', message: MESSAGES.loadFailed });
        return;
      }
      for (const widget of result.value) scheduler.markSaved(widget.id, widget.text);
      dispatch({ type: 'LOAD_SUCCEEDED', widgets: result.value });
    });
    return () => controller.abort();
  }, [api, scheduler, loadAttempt]);

  const reload = useCallback(() => {
    dispatch({ type: 'LOAD_STARTED' });
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  const addWidget = useCallback(async () => {
    dispatch({ type: 'CREATE_STARTED' });
    const result = await api.create();
    if (!result.ok) {
      dispatch({ type: 'CREATE_FAILED', message: MESSAGES.createFailed });
      return;
    }
    scheduler.markSaved(result.value.id, result.value.text);
    dispatch({ type: 'CREATE_SUCCEEDED', widget: result.value });
  }, [api, scheduler]);

  const deleteWidget = useCallback(
    async (id: WidgetId) => {
      // Remember unsaved edits so a failed delete can bring them back.
      const snapshot = scheduler.peek(id);
      scheduler.cancel(id);
      dispatch({ type: 'DELETE_STARTED', id });

      const result = await api.remove(id);
      const alreadyGone = !result.ok && result.error.kind === 'http' && result.error.status === 404;
      if (result.ok || alreadyGone) {
        dispatch({ type: 'DELETE_SUCCEEDED', id });
        return;
      }

      if (snapshot) {
        scheduler.markSaved(id, snapshot.lastSaved);
        if (snapshot.draft !== snapshot.lastSaved) scheduler.schedule(id, snapshot.draft);
      }
      dispatch({
        type: 'DELETE_FAILED',
        id,
        message: MESSAGES.deleteFailed,
        ...(snapshot && { text: snapshot.draft }),
      });
    },
    [api, scheduler],
  );

  const dismissNotice = useCallback(() => dispatch({ type: 'NOTICE_DISMISSED' }), []);

  const boardState = useMemo(() => toBoardState(state), [state]);
  return { state: boardState, reload, addWidget, deleteWidget, dismissNotice };
}

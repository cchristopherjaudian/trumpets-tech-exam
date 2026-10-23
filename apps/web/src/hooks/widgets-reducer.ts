import type { Widget, WidgetId } from '@text-widgets/shared';

/** What the board renders. */
export type BoardState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; widgets: Widget[]; pendingCreates: number; notice?: string };

/**
 * Internal state. Widgets being deleted stay in `widgets` (hidden via `deletingIds`) so a
 * failed deletion is restored in its exact original position, even with concurrent deletes.
 */
export interface WidgetsState {
  phase: BoardState['phase'];
  widgets: Widget[];
  deletingIds: ReadonlySet<WidgetId>;
  pendingCreates: number;
  error?: string;
  notice?: string;
}

export type WidgetsAction =
  | { type: 'LOAD_STARTED' }
  | { type: 'LOAD_SUCCEEDED'; widgets: Widget[] }
  | { type: 'LOAD_FAILED'; message: string }
  | { type: 'CREATE_STARTED' }
  | { type: 'CREATE_SUCCEEDED'; widget: Widget }
  | { type: 'CREATE_FAILED'; message: string }
  | { type: 'DELETE_STARTED'; id: WidgetId }
  | { type: 'DELETE_SUCCEEDED'; id: WidgetId }
  /** `text` is the latest draft to show when the widget reappears. */
  | { type: 'DELETE_FAILED'; id: WidgetId; text?: string; message: string }
  | { type: 'NOTICE_DISMISSED' };

export const initialWidgetsState: WidgetsState = {
  phase: 'loading',
  widgets: [],
  deletingIds: new Set(),
  pendingCreates: 0,
};

const withoutId = (ids: ReadonlySet<WidgetId>, id: WidgetId) => {
  const next = new Set(ids);
  next.delete(id);
  return next;
};

export function widgetsReducer(state: WidgetsState, action: WidgetsAction): WidgetsState {
  switch (action.type) {
    case 'LOAD_STARTED':
      return initialWidgetsState;
    case 'LOAD_SUCCEEDED':
      return { ...initialWidgetsState, phase: 'ready', widgets: action.widgets };
    case 'LOAD_FAILED':
      return { ...initialWidgetsState, phase: 'error', error: action.message };
    case 'NOTICE_DISMISSED': {
      const { notice: _dismissed, ...rest } = state;
      return rest;
    }
  }

  // Everything below mutates the widget list, which only exists once loaded.
  if (state.phase !== 'ready') return state;

  switch (action.type) {
    case 'CREATE_STARTED':
      return { ...state, pendingCreates: state.pendingCreates + 1 };
    case 'CREATE_SUCCEEDED':
      return {
        ...state,
        widgets: [...state.widgets, action.widget],
        pendingCreates: state.pendingCreates - 1,
      };
    case 'CREATE_FAILED':
      return { ...state, pendingCreates: state.pendingCreates - 1, notice: action.message };
    case 'DELETE_STARTED':
      return { ...state, deletingIds: new Set(state.deletingIds).add(action.id) };
    case 'DELETE_SUCCEEDED':
      return {
        ...state,
        widgets: state.widgets.filter((widget) => widget.id !== action.id),
        deletingIds: withoutId(state.deletingIds, action.id),
      };
    case 'DELETE_FAILED': {
      const { text } = action;
      return {
        ...state,
        widgets:
          text === undefined
            ? state.widgets
            : state.widgets.map((widget) => (widget.id === action.id ? { ...widget, text } : widget)),
        deletingIds: withoutId(state.deletingIds, action.id),
        notice: action.message,
      };
    }
  }
}

export function toBoardState(state: WidgetsState): BoardState {
  switch (state.phase) {
    case 'loading':
      return { phase: 'loading' };
    case 'error':
      return { phase: 'error', message: state.error ?? 'Something went wrong.' };
    case 'ready':
      return {
        phase: 'ready',
        widgets: state.widgets.filter((widget) => !state.deletingIds.has(widget.id)),
        pendingCreates: state.pendingCreates,
        ...(state.notice !== undefined && { notice: state.notice }),
      };
  }
}

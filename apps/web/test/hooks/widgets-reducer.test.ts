import type { Widget } from '@text-widgets/shared';
import { describe, expect, it } from 'vitest';
import {
  initialWidgetsState,
  toBoardState,
  widgetsReducer,
  type WidgetsAction,
  type WidgetsState,
} from '../../src/hooks/widgets-reducer.js';

const widget = (id: string, text = ''): Widget => ({
  id,
  text,
  createdAt: '2026-10-23T00:00:00.000Z',
  updatedAt: '2026-10-23T00:00:00.000Z',
});

const run = (...actions: WidgetsAction[]) =>
  actions.reduce<WidgetsState>(widgetsReducer, initialWidgetsState);

const ready = (...widgets: Widget[]) => run({ type: 'LOAD_SUCCEEDED', widgets });

describe('widgetsReducer', () => {
  describe('loading', () => {
    it('starts in the loading phase', () => {
      expect(toBoardState(initialWidgetsState)).toEqual({ phase: 'loading' });
    });

    it('becomes ready with the loaded widgets in their stored order', () => {
      const state = ready(widget('a'), widget('b'));

      expect(toBoardState(state)).toEqual({
        phase: 'ready',
        widgets: [widget('a'), widget('b')],
        pendingCreates: 0,
      });
    });

    it('reports a load failure as an error phase with a message', () => {
      const state = run({ type: 'LOAD_FAILED', message: 'Could not load widgets.' });

      expect(toBoardState(state)).toEqual({ phase: 'error', message: 'Could not load widgets.' });
    });

    it('returns to loading when a load is retried', () => {
      const state = run(
        { type: 'LOAD_FAILED', message: 'x' },
        { type: 'LOAD_STARTED' },
      );

      expect(toBoardState(state)).toEqual({ phase: 'loading' });
    });
  });

  describe('creating', () => {
    it('tracks concurrent pending creations', () => {
      const state = widgetsReducer(
        widgetsReducer(ready(), { type: 'CREATE_STARTED' }),
        { type: 'CREATE_STARTED' },
      );

      expect(toBoardState(state)).toMatchObject({ pendingCreates: 2 });
    });

    it('appends created widgets after existing ones', () => {
      const state = [
        { type: 'CREATE_STARTED' },
        { type: 'CREATE_SUCCEEDED', widget: widget('b') },
        { type: 'CREATE_STARTED' },
        { type: 'CREATE_SUCCEEDED', widget: widget('c') },
      ].reduce<WidgetsState>((s, a) => widgetsReducer(s, a as WidgetsAction), ready(widget('a')));

      expect(toBoardState(state)).toEqual({
        phase: 'ready',
        widgets: [widget('a'), widget('b'), widget('c')],
        pendingCreates: 0,
      });
    });

    it('surfaces a failed creation as a dismissible notice', () => {
      let state = widgetsReducer(ready(), { type: 'CREATE_STARTED' });
      state = widgetsReducer(state, { type: 'CREATE_FAILED', message: 'Could not add a widget.' });

      expect(toBoardState(state)).toMatchObject({ pendingCreates: 0, notice: 'Could not add a widget.' });

      state = widgetsReducer(state, { type: 'NOTICE_DISMISSED' });
      expect(toBoardState(state)).not.toHaveProperty('notice');
    });
  });

  describe('deleting', () => {
    it('hides a widget immediately while its deletion is in flight', () => {
      const state = widgetsReducer(ready(widget('a'), widget('b')), {
        type: 'DELETE_STARTED',
        id: 'a',
      });

      expect(toBoardState(state)).toMatchObject({ widgets: [widget('b')] });
    });

    it('removes the widget for good once deletion succeeds', () => {
      const state = run(
        { type: 'LOAD_SUCCEEDED', widgets: [widget('a'), widget('b')] },
        { type: 'DELETE_STARTED', id: 'a' },
        { type: 'DELETE_SUCCEEDED', id: 'a' },
      );

      expect(state.widgets).toEqual([widget('b')]);
      expect(state.deletingIds.size).toBe(0);
    });

    it('restores a failed deletion in its original position with its latest text', () => {
      const state = run(
        { type: 'LOAD_SUCCEEDED', widgets: [widget('a'), widget('b', 'old'), widget('c')] },
        { type: 'DELETE_STARTED', id: 'b' },
        { type: 'DELETE_FAILED', id: 'b', text: 'latest draft', message: 'Could not delete.' },
      );

      expect(toBoardState(state)).toEqual({
        phase: 'ready',
        widgets: [widget('a'), widget('b', 'latest draft'), widget('c')],
        pendingCreates: 0,
        notice: 'Could not delete.',
      });
    });

    it('restores concurrent failed deletions in their original order', () => {
      const state = run(
        { type: 'LOAD_SUCCEEDED', widgets: [widget('a'), widget('b'), widget('c'), widget('d')] },
        { type: 'DELETE_STARTED', id: 'a' },
        { type: 'DELETE_STARTED', id: 'c' },
        { type: 'DELETE_STARTED', id: 'b' },
        { type: 'DELETE_FAILED', id: 'c', text: '', message: 'x' },
        { type: 'DELETE_FAILED', id: 'a', text: '', message: 'x' },
      );

      expect(toBoardState(state)).toMatchObject({
        widgets: [widget('a'), widget('c'), widget('d')],
      });
    });

    it('keeps newly created widgets after a restored one', () => {
      const state = run(
        { type: 'LOAD_SUCCEEDED', widgets: [widget('a')] },
        { type: 'DELETE_STARTED', id: 'a' },
        { type: 'CREATE_STARTED' },
        { type: 'CREATE_SUCCEEDED', widget: widget('b') },
        { type: 'DELETE_FAILED', id: 'a', text: '', message: 'x' },
      );

      expect(toBoardState(state)).toMatchObject({ widgets: [widget('a'), widget('b')] });
    });
  });

  it('ignores widget mutations before widgets are loaded', () => {
    const state = run({ type: 'CREATE_SUCCEEDED', widget: widget('a') });

    expect(toBoardState(state)).toEqual({ phase: 'loading' });
  });
});

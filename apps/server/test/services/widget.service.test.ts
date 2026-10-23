import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryWidgetRepository } from '../../src/repositories/in-memory-widget.repository.js';
import { createWidgetService, type WidgetService } from '../../src/services/widget.service.js';

const T0 = '2026-10-23T10:00:00.000Z';
const T1 = '2026-10-23T10:00:05.000Z';
const T2 = '2026-10-23T10:00:09.000Z';

describe('WidgetService', () => {
  let repository: InMemoryWidgetRepository;
  let service: WidgetService;
  let now: string;
  let nextId: number;

  beforeEach(() => {
    repository = new InMemoryWidgetRepository();
    now = T0;
    nextId = 0;
    service = createWidgetService({
      repository,
      clock: () => new Date(now),
      generateId: () => `id-${++nextId}`,
    });
  });

  describe('create', () => {
    it('creates a widget with a generated id, the given text and matching timestamps', () => {
      const widget = service.create({ text: 'hello' });

      expect(widget).toEqual({ id: 'id-1', text: 'hello', createdAt: T0, updatedAt: T0 });
    });

    it('persists the widget so it is listed and retrievable', () => {
      const widget = service.create({ text: '' });

      expect(service.list()).toEqual([widget]);
      expect(repository.get(widget.id)).toEqual(widget);
    });

    it('generates a unique id per widget and lists them in creation order', () => {
      const first = service.create({ text: 'first' });
      const second = service.create({ text: 'second' });
      const third = service.create({ text: 'third' });

      expect(new Set([first.id, second.id, third.id]).size).toBe(3);
      expect(service.list().map((widget) => widget.text)).toEqual(['first', 'second', 'third']);
    });

    it('uses crypto UUIDs when no id generator is injected', () => {
      const defaultService = createWidgetService({ repository: new InMemoryWidgetRepository() });

      expect(defaultService.create({ text: '' }).id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    });
  });

  describe('updateText', () => {
    it('updates the text and refreshes updatedAt, keeping id and createdAt', () => {
      const widget = service.create({ text: 'draft' });
      now = T1;

      const result = service.updateText(widget.id, 'final');

      expect(result).toEqual({
        ok: true,
        value: { id: widget.id, text: 'final', createdAt: T0, updatedAt: T1 },
      });
      expect(repository.get(widget.id)).toEqual({ ...widget, text: 'final', updatedAt: T1 });
    });

    it('keeps the widget in its original position', () => {
      const first = service.create({ text: 'a' });
      service.create({ text: 'b' });
      service.create({ text: 'c' });
      now = T2;

      service.updateText(first.id, 'a2');

      expect(service.list().map((widget) => widget.text)).toEqual(['a2', 'b', 'c']);
    });

    it('stores large unicode text verbatim', () => {
      const widget = service.create({ text: '' });
      const text = 'Ünïcødé 🎺\n'.repeat(500);

      service.updateText(widget.id, text);

      expect(service.list()[0]?.text).toBe(text);
    });

    it('reports not found for an unknown id without creating a widget', () => {
      service.create({ text: 'existing' });
      const before = service.list();

      const result = service.updateText('missing', 'text');

      expect(result).toEqual({ ok: false, error: { kind: 'NOT_FOUND', id: 'missing' } });
      expect(service.list()).toEqual(before);
    });
  });

  describe('delete', () => {
    it('removes the widget so it is no longer listed', () => {
      const first = service.create({ text: 'a' });
      const second = service.create({ text: 'b' });

      expect(service.delete(first.id)).toEqual({ ok: true, value: undefined });
      expect(service.list()).toEqual([second]);
    });

    it('reports not found for an unknown id and leaves other widgets unchanged', () => {
      const widget = service.create({ text: 'keep me' });

      expect(service.delete('missing')).toEqual({
        ok: false,
        error: { kind: 'NOT_FOUND', id: 'missing' },
      });
      expect(service.list()).toEqual([widget]);
    });

    it('reports not found when deleting the same widget twice', () => {
      const widget = service.create({ text: '' });
      service.delete(widget.id);

      expect(service.delete(widget.id)).toMatchObject({ ok: false });
    });
  });
});

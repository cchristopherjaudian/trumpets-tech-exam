import type { Widget } from '@text-widgets/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryWidgetRepository } from '../../src/repositories/in-memory-widget.repository.js';

function makeWidget(id: string, text = ''): Widget {
  return {
    id,
    text,
    createdAt: '2026-10-23T00:00:00.000Z',
    updatedAt: '2026-10-23T00:00:00.000Z',
  };
}

const ids = (widgets: Widget[]) => widgets.map((widget) => widget.id);

describe('InMemoryWidgetRepository', () => {
  let repository: InMemoryWidgetRepository;

  beforeEach(() => {
    repository = new InMemoryWidgetRepository();
  });

  it('starts empty', () => {
    expect(repository.list()).toEqual([]);
  });

  it('returns widgets in creation order', () => {
    repository.insert(makeWidget('c'));
    repository.insert(makeWidget('a'));
    repository.insert(makeWidget('b'));

    expect(ids(repository.list())).toEqual(['c', 'a', 'b']);
  });

  it('gets a widget by id', () => {
    repository.insert(makeWidget('a', 'hello'));

    expect(repository.get('a')).toEqual(makeWidget('a', 'hello'));
  });

  it('returns undefined for an unknown id', () => {
    expect(repository.get('missing')).toBeUndefined();
  });

  it('rejects inserting a duplicate id', () => {
    repository.insert(makeWidget('a'));

    expect(() => repository.insert(makeWidget('a'))).toThrow(/already exists/);
  });

  describe('update', () => {
    it('replaces the stored widget and keeps its position', () => {
      repository.insert(makeWidget('a'));
      repository.insert(makeWidget('b'));
      repository.insert(makeWidget('c'));

      const updated = repository.update({ ...makeWidget('a', 'edited'), updatedAt: 'later' });

      expect(updated).toBe(true);
      expect(ids(repository.list())).toEqual(['a', 'b', 'c']);
      expect(repository.get('a')).toMatchObject({ text: 'edited', updatedAt: 'later' });
    });

    it('does not insert a widget that does not exist', () => {
      expect(repository.update(makeWidget('ghost', 'boo'))).toBe(false);
      expect(repository.list()).toEqual([]);
    });
  });

  describe('delete', () => {
    it('removes the widget and preserves the order of the rest', () => {
      repository.insert(makeWidget('a'));
      repository.insert(makeWidget('b'));
      repository.insert(makeWidget('c'));

      expect(repository.delete('b')).toBe(true);
      expect(ids(repository.list())).toEqual(['a', 'c']);
      expect(repository.get('b')).toBeUndefined();
    });

    it('reports false when deleting a missing widget', () => {
      repository.insert(makeWidget('a'));

      expect(repository.delete('missing')).toBe(false);
      expect(ids(repository.list())).toEqual(['a']);
    });

    it('appends a re-inserted id at the end', () => {
      repository.insert(makeWidget('a'));
      repository.insert(makeWidget('b'));
      repository.delete('a');
      repository.insert(makeWidget('a'));

      expect(ids(repository.list())).toEqual(['b', 'a']);
    });
  });

  describe('copy isolation', () => {
    it('is unaffected by mutating a widget after inserting it', () => {
      const widget = makeWidget('a', 'original');
      repository.insert(widget);
      widget.text = 'mutated';

      expect(repository.get('a')?.text).toBe('original');
    });

    it('is unaffected by mutating a widget after updating with it', () => {
      repository.insert(makeWidget('a'));
      const widget = makeWidget('a', 'updated');
      repository.update(widget);
      widget.text = 'mutated';

      expect(repository.get('a')?.text).toBe('updated');
    });

    it('is unaffected by mutating results of get and list', () => {
      repository.insert(makeWidget('a', 'original'));

      const fromGet = repository.get('a');
      if (fromGet) fromGet.text = 'mutated via get';
      const fromList = repository.list();
      const first = fromList[0];
      if (first) first.text = 'mutated via list';
      fromList.length = 0;

      expect(repository.list()).toEqual([makeWidget('a', 'original')]);
    });
  });

  it('stores large and unicode text verbatim', () => {
    const text = `${'🎺 Café\n'.repeat(1_500)}end`;
    repository.insert(makeWidget('a', text));

    expect(repository.get('a')?.text).toBe(text);
  });
});

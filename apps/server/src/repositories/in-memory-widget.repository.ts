import type { Widget, WidgetId } from '@text-widgets/shared';
import type { WidgetRepository } from './widget.repository.js';

/**
 * Process-lifetime widget storage. A `Map` preserves insertion order, so it doubles as the
 * creation-order index while giving O(1) get/update/delete. Updating an existing key keeps
 * its position.
 */
export class InMemoryWidgetRepository implements WidgetRepository {
  private readonly widgets = new Map<WidgetId, Widget>();

  list(): Widget[] {
    return Array.from(this.widgets.values(), copy);
  }

  get(id: WidgetId): Widget | undefined {
    const widget = this.widgets.get(id);
    return widget && copy(widget);
  }

  insert(widget: Widget): void {
    if (this.widgets.has(widget.id)) {
      throw new Error(`Widget ${widget.id} already exists`);
    }
    this.widgets.set(widget.id, copy(widget));
  }

  update(widget: Widget): boolean {
    if (!this.widgets.has(widget.id)) {
      return false;
    }
    this.widgets.set(widget.id, copy(widget));
    return true;
  }

  delete(id: WidgetId): boolean {
    return this.widgets.delete(id);
  }
}

// Widgets only hold primitives, so a shallow copy fully isolates callers from stored state.
const copy = (widget: Widget): Widget => ({ ...widget });

import type { Widget, WidgetId } from '@text-widgets/shared';

/**
 * Persistence port for widgets. Implementations must return widgets in creation order
 * and must never hand out references to their internal state.
 */
export interface WidgetRepository {
  /** All widgets in creation order. */
  list(): Widget[];
  get(id: WidgetId): Widget | undefined;
  /** Appends a new widget. Throws if the id is already stored. */
  insert(widget: Widget): void;
  /** Replaces an existing widget in place. Returns false (and stores nothing) if it does not exist. */
  update(widget: Widget): boolean;
  /** Returns false if the widget did not exist. */
  delete(id: WidgetId): boolean;
}

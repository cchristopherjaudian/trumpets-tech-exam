/** Server-generated UUID identifying a widget. */
export type WidgetId = string;

/** ISO 8601 timestamp in UTC. */
export type IsoDateTime = string;

export interface Widget {
  id: WidgetId;
  text: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface ListWidgetsResponse {
  widgets: Widget[];
}

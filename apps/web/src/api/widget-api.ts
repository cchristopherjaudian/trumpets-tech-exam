import {
  API_ERROR_CODES,
  type ApiErrorBody,
  type ApiErrorCode,
  type ListWidgetsResponse,
  type Widget,
  type WidgetId,
} from '@text-widgets/shared';
import { err, ok, type ApiError, type Result } from './result.js';

/** Browsers cap in-flight keepalive bodies at 64 KiB; stay safely below that. */
export const KEEPALIVE_BODY_LIMIT_BYTES = 60 * 1024;

export interface WidgetApi {
  list(signal?: AbortSignal): Promise<Result<Widget[]>>;
  create(): Promise<Result<Widget>>;
  /** `keepalive` lets the save outlive the page (used when the tab is hidden or closed). */
  updateText(id: WidgetId, text: string, options?: { keepalive?: boolean }): Promise<Result<Widget>>;
  remove(id: WidgetId): Promise<Result<void>>;
}

export interface WidgetApiOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

/** Typed client for the Widget Service. Every call resolves to a Result and never throws. */
export function createWidgetApi({
  baseUrl = '',
  // Wrapped so `fetch` is always invoked with the global as `this`.
  fetchFn = (...args) => fetch(...args),
}: WidgetApiOptions = {}): WidgetApi {
  const widgetsUrl = `${baseUrl}/api/widgets`;
  const widgetUrl = (id: WidgetId) => `${widgetsUrl}/${encodeURIComponent(id)}`;

  async function send<T>(
    url: string,
    init: RequestInit,
    readBody: (response: Response) => Promise<T>,
  ): Promise<Result<T>> {
    let response: Response;
    try {
      response = await fetchFn(url, init);
    } catch (error) {
      return err({
        kind: 'network',
        message: error instanceof Error ? error.message : 'Network request failed',
      });
    }

    if (!response.ok) {
      return err(await toHttpError(response));
    }
    try {
      return ok(await readBody(response));
    } catch {
      return err({
        kind: 'http',
        status: response.status,
        code: 'INTERNAL_ERROR',
        message: 'Invalid response from server',
      });
    }
  }

  const readJson = <T>(response: Response) => response.json() as Promise<T>;

  return {
    list: (signal) =>
      send(widgetsUrl, { method: 'GET', ...(signal && { signal }) }, async (response) => {
        const body = await readJson<ListWidgetsResponse>(response);
        return body.widgets;
      }),

    create: () => send(widgetsUrl, { method: 'POST' }, readJson<Widget>),

    updateText(id, text, { keepalive = false } = {}) {
      const body = JSON.stringify({ text });
      const useKeepalive =
        keepalive && new TextEncoder().encode(body).byteLength <= KEEPALIVE_BODY_LIMIT_BYTES;
      return send(
        widgetUrl(id),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body,
          ...(useKeepalive && { keepalive: true }),
        },
        readJson<Widget>,
      );
    },

    remove: (id) => send(widgetUrl(id), { method: 'DELETE' }, async () => undefined),
  };
}

async function toHttpError(response: Response): Promise<ApiError> {
  const { status } = response;
  const body: unknown = await response.json().catch(() => undefined);
  if (isApiErrorBody(body)) {
    return { kind: 'http', status, code: body.error.code, message: body.error.message };
  }
  return { kind: 'http', status, code: codeForStatus(status), message: `Request failed with status ${status}` };
}

function isApiErrorBody(body: unknown): body is ApiErrorBody {
  if (typeof body !== 'object' || body === null || !('error' in body)) return false;
  const { error } = body;
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    API_ERROR_CODES.includes(error.code as ApiErrorCode) &&
    typeof error.message === 'string'
  );
}

function codeForStatus(status: number): ApiErrorCode {
  if (status === 404) return 'NOT_FOUND';
  if (status === 413) return 'PAYLOAD_TOO_LARGE';
  if (status >= 400 && status < 500) return 'VALIDATION_ERROR';
  return 'INTERNAL_ERROR';
}

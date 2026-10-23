import type { Widget } from '@text-widgets/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWidgetApi, KEEPALIVE_BODY_LIMIT_BYTES, type WidgetApi } from '../../src/api/widget-api.js';

const ID = '3f2b8c1e-9d4a-4f6b-8e2a-1c5d7f9b0a3e';
const widget: Widget = {
  id: ID,
  text: 'hello',
  createdAt: '2026-10-23T00:00:00.000Z',
  updatedAt: '2026-10-23T00:00:00.000Z',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('WidgetApi', () => {
  let fetchFn: ReturnType<typeof vi.fn<typeof fetch>>;
  let api: WidgetApi;

  beforeEach(() => {
    fetchFn = vi.fn<typeof fetch>();
    api = createWidgetApi({ fetchFn });
  });

  const lastCall = () => {
    const call = fetchFn.mock.lastCall;
    if (!call) throw new Error('fetch was not called');
    const [url, init = {}] = call;
    return { url: String(url), init };
  };

  describe('requests', () => {
    it('lists widgets with GET /api/widgets and unwraps the list', async () => {
      fetchFn.mockResolvedValue(json({ widgets: [widget] }));
      const controller = new AbortController();

      const result = await api.list(controller.signal);

      expect(result).toEqual({ ok: true, value: [widget] });
      expect(lastCall().url).toBe('/api/widgets');
      expect(lastCall().init).toMatchObject({ method: 'GET', signal: controller.signal });
    });

    it('creates a widget with POST /api/widgets', async () => {
      fetchFn.mockResolvedValue(json(widget, 201));

      expect(await api.create()).toEqual({ ok: true, value: widget });
      expect(lastCall()).toMatchObject({ url: '/api/widgets', init: { method: 'POST' } });
    });

    it('updates text with a JSON PATCH to /api/widgets/:id', async () => {
      fetchFn.mockResolvedValue(json({ ...widget, text: 'new' }));

      const result = await api.updateText(ID, 'new');

      expect(result).toEqual({ ok: true, value: { ...widget, text: 'new' } });
      const { url, init } = lastCall();
      expect(url).toBe(`/api/widgets/${ID}`);
      expect(init.method).toBe('PATCH');
      expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
      expect(JSON.parse(String(init.body))).toEqual({ text: 'new' });
    });

    it('deletes with DELETE /api/widgets/:id and resolves to undefined on 204', async () => {
      fetchFn.mockResolvedValue(new Response(null, { status: 204 }));

      expect(await api.remove(ID)).toEqual({ ok: true, value: undefined });
      expect(lastCall()).toMatchObject({ url: `/api/widgets/${ID}`, init: { method: 'DELETE' } });
    });

    it('prefixes every request with the configured base URL', async () => {
      fetchFn.mockResolvedValue(json({ widgets: [] }));
      api = createWidgetApi({ fetchFn, baseUrl: 'http://api.test' });

      await api.list();

      expect(lastCall().url).toBe('http://api.test/api/widgets');
    });

    it('encodes widget ids in the path', async () => {
      fetchFn.mockResolvedValue(new Response(null, { status: 204 }));

      await api.remove('a/b?c');

      expect(lastCall().url).toBe('/api/widgets/a%2Fb%3Fc');
    });
  });

  describe('unicode text', () => {
    it('sends text that round-trips exactly through JSON encoding', async () => {
      const text = 'Café 日本語 👩‍👩‍👧 🎺\r\n\ttabs "quotes" \\ backslash';
      fetchFn.mockResolvedValue(json({ ...widget, text }));

      const result = await api.updateText(ID, text);

      expect(JSON.parse(String(lastCall().init.body))).toEqual({ text });
      expect(result).toEqual({ ok: true, value: { ...widget, text } });
    });
  });

  describe('error mapping', () => {
    it('maps an error envelope to an http error with its code and message', async () => {
      fetchFn.mockResolvedValue(
        json({ error: { code: 'NOT_FOUND', message: `Widget ${ID} not found` } }, 404),
      );

      expect(await api.updateText(ID, 'x')).toEqual({
        ok: false,
        error: { kind: 'http', status: 404, code: 'NOT_FOUND', message: `Widget ${ID} not found` },
      });
    });

    it.each([
      [400, 'VALIDATION_ERROR'],
      [404, 'NOT_FOUND'],
      [413, 'PAYLOAD_TOO_LARGE'],
      [502, 'INTERNAL_ERROR'],
    ] as const)('derives a code from status %i when the body is not an envelope', async (status, code) => {
      fetchFn.mockResolvedValue(new Response('<html>Bad Gateway</html>', { status }));

      expect(await api.list()).toEqual({
        ok: false,
        error: { kind: 'http', status, code, message: `Request failed with status ${status}` },
      });
    });

    it('maps a thrown fetch to a network error', async () => {
      fetchFn.mockRejectedValue(new TypeError('Failed to fetch'));

      expect(await api.create()).toEqual({
        ok: false,
        error: { kind: 'network', message: 'Failed to fetch' },
      });
    });

    it('maps an unreadable success body to an internal http error', async () => {
      fetchFn.mockResolvedValue(new Response('not json', { status: 200 }));

      expect(await api.list()).toEqual({
        ok: false,
        error: {
          kind: 'http',
          status: 200,
          code: 'INTERNAL_ERROR',
          message: 'Invalid response from server',
        },
      });
    });

    it('never throws, even for unexpected rejection values', async () => {
      fetchFn.mockRejectedValue('boom');

      await expect(api.remove(ID)).resolves.toEqual({
        ok: false,
        error: { kind: 'network', message: 'Network request failed' },
      });
    });
  });

  describe('keepalive', () => {
    it('stays under the 64 KiB browser keepalive budget', () => {
      expect(KEEPALIVE_BODY_LIMIT_BYTES).toBe(60 * 1024);
    });

    it('is off unless requested', async () => {
      fetchFn.mockResolvedValue(json(widget));

      await api.updateText(ID, 'small');

      expect(lastCall().init.keepalive).toBeUndefined();
    });

    it('is applied to small payloads when requested', async () => {
      fetchFn.mockResolvedValue(json(widget));

      await api.updateText(ID, 'small', { keepalive: true });

      expect(lastCall().init.keepalive).toBe(true);
    });

    it('measures the payload in UTF-8 bytes and skips keepalive above the budget', async () => {
      fetchFn.mockResolvedValue(json(widget));
      // 16,000 emoji = 32,000 UTF-16 units (within the text limit) but 64,000 UTF-8 bytes.
      const text = '🎺'.repeat(16_000);

      await api.updateText(ID, text, { keepalive: true });

      expect(lastCall().init.keepalive).toBeUndefined();
      expect(JSON.parse(String(lastCall().init.body))).toEqual({ text });
    });
  });
});

import { MAX_TEXT_LENGTH, type ApiErrorBody, type Widget } from '@text-widgets/shared';
import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';

const UNKNOWN_ID = '0b9e7c55-2f61-4c7a-9d3e-5a8b1f4c2e70';

describe('Widget Service API end to end', () => {
  let app: Express;
  let now: number;

  beforeEach(() => {
    now = Date.parse('2026-10-23T09:00:00.000Z');
    app = createApp({ clock: () => new Date(now), logger: { error: vi.fn() } });
  });

  const advance = (ms: number) => {
    now += ms;
  };

  const create = async (text?: string): Promise<Widget> => {
    const response = await request(app)
      .post('/api/widgets')
      .send(text === undefined ? undefined : { text })
      .expect(201);
    return response.body as Widget;
  };

  const update = (id: string, body: unknown) =>
    request(app).patch(`/api/widgets/${id}`).send(body as object);

  const list = async (): Promise<Widget[]> =>
    ((await request(app).get('/api/widgets').expect(200)).body as { widgets: Widget[] }).widgets;

  const expectError = (
    response: request.Response,
    status: number,
    code: ApiErrorBody['error']['code'],
  ) => {
    expect(response.status).toBe(status);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body).toEqual({
      error: expect.objectContaining({ code, message: expect.any(String) }),
    });
  };

  it('supports the full create → list → update → list → delete lifecycle', async () => {
    const first = await create();
    advance(1_000);
    const second = await create('second');
    advance(1_000);
    const third = await create('third');

    expect(await list()).toEqual([first, second, third]);

    advance(5_000);
    const updated = await update(second.id, { text: 'second, edited' }).expect(200);
    expect(updated.body).toEqual({
      ...second,
      text: 'second, edited',
      updatedAt: '2026-10-23T09:00:07.000Z',
    });

    const afterUpdate = await list();
    expect(afterUpdate.map((widget) => widget.id)).toEqual([first.id, second.id, third.id]);
    expect(afterUpdate.map((widget) => widget.text)).toEqual(['', 'second, edited', 'third']);

    await request(app).delete(`/api/widgets/${second.id}`).expect(204);
    expect(await list()).toEqual([first, third]);

    expectError(await update(second.id, { text: 'zombie' }), 404, 'NOT_FOUND');
    expectError(await request(app).delete(`/api/widgets/${second.id}`), 404, 'NOT_FOUND');
  });

  it('keeps widgets independent: updating one never changes another', async () => {
    const a = await create('alpha');
    const b = await create('beta');

    await update(a.id, { text: 'alpha changed' }).expect(200);

    expect((await list()).find((widget) => widget.id === b.id)?.text).toBe('beta');
  });

  describe('text fidelity', () => {
    it.each([
      ['1,000 characters', 'Lorem ipsum dolor sit amet. '.repeat(36).slice(0, 1_000)],
      ['10,000 characters', 'x'.repeat(10_000)],
      ['the maximum length', 'y'.repeat(MAX_TEXT_LENGTH)],
      ['unicode with line breaks', 'Café naïve façade\n日本語テキスト\r\nمرحبا\t👩‍👩‍👧 🎺🚀\n\n'],
      ['leading/trailing whitespace', '   spaced   \n\t\tindented\n   '],
    ])('round-trips %s exactly through update and reload', async (_label, text) => {
      const widget = await create();

      const response = await update(widget.id, { text }).expect(200);

      expect(response.body.text).toBe(text);
      const [stored] = await list();
      expect(stored?.text).toBe(text);
      expect(stored?.text.length).toBe(text.length);
    });

    it('round-trips a 1,000-character string supplied at creation', async () => {
      const text = 'ab🎺'.repeat(250);
      expect(text.length).toBe(1_000);

      await create(text);

      expect((await list())[0]?.text).toBe(text);
    });

    it('counts emoji as two units: exactly max units is accepted, one emoji more is rejected', async () => {
      const widget = await create();
      const atLimit = '🎺'.repeat(MAX_TEXT_LENGTH / 2);

      await update(widget.id, { text: atLimit }).expect(200);
      expectError(await update(widget.id, { text: `${atLimit}🎺` }), 400, 'VALIDATION_ERROR');
      expect((await list())[0]?.text).toBe(atLimit);
    });
  });

  describe('rejected writes leave stored data unchanged', () => {
    it.each([
      ['over-limit text', { text: 'z'.repeat(MAX_TEXT_LENGTH + 1) }],
      ['numeric text', { text: 7 }],
      ['null text', { text: null }],
      ['object text', { text: { nested: true } }],
      ['missing text', { other: 'field' }],
    ])('rejects %s with VALIDATION_ERROR details', async (_label, body) => {
      const widget = await create('keep me');
      advance(1_000);

      const response = await update(widget.id, body);

      expectError(response, 400, 'VALIDATION_ERROR');
      expect(response.body.error.details).toEqual([
        { path: 'text', message: expect.any(String) },
      ]);
      expect(await list()).toEqual([widget]);
    });

    it('rejects malformed JSON without touching the widget', async () => {
      const widget = await create('keep me');

      const response = await request(app)
        .patch(`/api/widgets/${widget.id}`)
        .set('Content-Type', 'application/json')
        .send('{"text": ');

      expectError(response, 400, 'VALIDATION_ERROR');
      expect(await list()).toEqual([widget]);
    });

    it('rejects an oversize body with PAYLOAD_TOO_LARGE without touching the widget', async () => {
      const widget = await create('keep me');

      const response = await update(widget.id, { text: 'q'.repeat(1024 * 1024) });

      expectError(response, 413, 'PAYLOAD_TOO_LARGE');
      expect(await list()).toEqual([widget]);
    });

    it('rejects over-limit text at creation without creating a widget', async () => {
      const response = await request(app)
        .post('/api/widgets')
        .send({ text: 'z'.repeat(MAX_TEXT_LENGTH + 1) });

      expectError(response, 400, 'VALIDATION_ERROR');
      expect(await list()).toEqual([]);
    });
  });

  describe('identifier handling', () => {
    it.each(['not-a-uuid', '12345', `${UNKNOWN_ID}0`])(
      'rejects malformed id %j on update and delete',
      async (id) => {
        expectError(await update(id, { text: 'x' }), 400, 'VALIDATION_ERROR');
        expectError(await request(app).delete(`/api/widgets/${id}`), 400, 'VALIDATION_ERROR');
      },
    );

    it('reports both an invalid id and invalid text in one response', async () => {
      const response = await update('bad-id', { text: 1 });

      expectError(response, 400, 'VALIDATION_ERROR');
      expect(response.body.error.details.map((issue: { path: string }) => issue.path)).toEqual([
        'id',
        'text',
      ]);
    });

    it('returns NOT_FOUND for a well-formed but unknown id on update and delete', async () => {
      await create('existing');

      expectError(await update(UNKNOWN_ID, { text: 'x' }), 404, 'NOT_FOUND');
      expectError(await request(app).delete(`/api/widgets/${UNKNOWN_ID}`), 404, 'NOT_FOUND');
      expect(await list()).toHaveLength(1);
    });
  });
});

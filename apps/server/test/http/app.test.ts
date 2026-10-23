import { MAX_TEXT_LENGTH, type Widget } from '@text-widgets/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, type AppDependencies } from '../../src/app.js';
import { InMemoryWidgetRepository } from '../../src/repositories/in-memory-widget.repository.js';

const UNKNOWN_ID = '3f2b8c1e-9d4a-4f6b-8e2a-1c5d7f9b0a3e';

function setup(overrides: Partial<AppDependencies> = {}) {
  const logger = { error: vi.fn() };
  const app = createApp({ logger, ...overrides });
  return { app, logger };
}

async function createWidget(app: ReturnType<typeof setup>['app'], text?: string): Promise<Widget> {
  const response = await request(app)
    .post('/api/widgets')
    .send(text === undefined ? undefined : { text });
  expect(response.status).toBe(201);
  return response.body as Widget;
}

describe('Widget Service HTTP API', () => {
  let app: ReturnType<typeof setup>['app'];
  let logger: ReturnType<typeof setup>['logger'];

  beforeEach(() => {
    ({ app, logger } = setup());
  });

  describe('GET /api/health', () => {
    it('reports ok', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  describe('GET /api/widgets', () => {
    it('returns an empty list as JSON initially', async () => {
      const response = await request(app).get('/api/widgets');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toEqual({ widgets: [] });
    });
  });

  describe('POST /api/widgets', () => {
    it('creates an empty widget when no body is sent', async () => {
      const response = await request(app).post('/api/widgets');

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        text: '',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('creates a widget with initial text', async () => {
      const widget = await createWidget(app, 'hello');

      expect(widget.text).toBe('hello');
      expect((await request(app).get('/api/widgets')).body).toEqual({ widgets: [widget] });
    });

    it('rejects non-string initial text', async () => {
      const response = await request(app).post('/api/widgets').send({ text: 123 });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect((await request(app).get('/api/widgets')).body).toEqual({ widgets: [] });
    });
  });

  describe('PATCH /api/widgets/:id', () => {
    it('updates the text and returns the updated widget', async () => {
      const widget = await createWidget(app);

      const response = await request(app)
        .patch(`/api/widgets/${widget.id}`)
        .send({ text: 'updated' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ id: widget.id, text: 'updated' });
    });

    it('returns 404 NOT_FOUND for an unknown id', async () => {
      const response = await request(app).patch(`/api/widgets/${UNKNOWN_ID}`).send({ text: 'x' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: { code: 'NOT_FOUND', message: `Widget ${UNKNOWN_ID} not found` },
      });
    });

    it('returns 400 with field details for a malformed id', async () => {
      const response = await request(app).patch('/api/widgets/not-a-uuid').send({ text: 'x' });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: [{ path: 'id', message: expect.any(String) }],
      });
    });

    it.each([
      ['non-string', { text: 42 }],
      ['missing', {}],
      ['over-limit', { text: 'x'.repeat(MAX_TEXT_LENGTH + 1) }],
    ])('rejects %s text with 400 and leaves stored text unchanged', async (_label, body) => {
      const widget = await createWidget(app, 'original');

      const response = await request(app).patch(`/api/widgets/${widget.id}`).send(body);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details[0].path).toBe('text');
      expect((await request(app).get('/api/widgets')).body.widgets[0].text).toBe('original');
    });
  });

  describe('DELETE /api/widgets/:id', () => {
    it('deletes the widget with 204 and no body', async () => {
      const widget = await createWidget(app);

      const response = await request(app).delete(`/api/widgets/${widget.id}`);

      expect(response.status).toBe(204);
      expect(response.text).toBe('');
      expect((await request(app).get('/api/widgets')).body).toEqual({ widgets: [] });
    });

    it('returns 404 NOT_FOUND for an unknown id', async () => {
      const response = await request(app).delete(`/api/widgets/${UNKNOWN_ID}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 400 for a malformed id', async () => {
      const response = await request(app).delete('/api/widgets/123');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('error handling', () => {
    it('maps malformed JSON to 400 VALIDATION_ERROR', async () => {
      const widget = await createWidget(app);

      const response = await request(app)
        .patch(`/api/widgets/${widget.id}`)
        .set('Content-Type', 'application/json')
        .send('{"text": "unterminated');

      expect(response.status).toBe(400);
      expect(response.body.error).toEqual({
        code: 'VALIDATION_ERROR',
        message: 'Malformed JSON body',
      });
    });

    it('maps bodies over 512kb to 413 PAYLOAD_TOO_LARGE', async () => {
      const widget = await createWidget(app);

      const response = await request(app)
        .patch(`/api/widgets/${widget.id}`)
        .send({ text: 'x'.repeat(600 * 1024) });

      expect(response.status).toBe(413);
      expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('accepts a maximum-length body of worst-case escaped characters', async () => {
      const widget = await createWidget(app);
      const text = '\u0001'.repeat(MAX_TEXT_LENGTH);

      const response = await request(app).patch(`/api/widgets/${widget.id}`).send({ text });

      expect(response.status).toBe(200);
      expect(response.body.text).toBe(text);
    });

    it('returns 404 NOT_FOUND for unknown API routes', async () => {
      const response = await request(app).get('/api/nope');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: { code: 'NOT_FOUND', message: 'Route GET /api/nope not found' },
      });
    });

    it('hides unexpected failures behind a generic 500 and logs the details', async () => {
      const repository = new InMemoryWidgetRepository();
      const failure = new Error('disk on fire');
      vi.spyOn(repository, 'list').mockImplementation(() => {
        throw failure;
      });
      ({ app, logger } = setup({ repository }));

      const response = await request(app).get('/api/widgets');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      });
      expect(JSON.stringify(response.body)).not.toContain('disk on fire');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('GET /api/widgets'), failure);
    });

    it('does not advertise the framework', async () => {
      const response = await request(app).get('/api/health');

      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  it('uses the injected clock and id generator', async () => {
    ({ app } = setup({
      clock: () => new Date('2026-01-01T00:00:00.000Z'),
      generateId: () => UNKNOWN_ID,
    }));

    const widget = await createWidget(app);

    expect(widget).toEqual({
      id: UNKNOWN_ID,
      text: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  });
});

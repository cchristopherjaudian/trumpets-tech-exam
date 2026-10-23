import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';

const INDEX_HTML = '<!doctype html><title>Text widgets</title><div id="root"></div>';
const APP_JS = 'console.log("app");';

describe('production static hosting', () => {
  let staticDir: string;

  beforeAll(() => {
    staticDir = mkdtempSync(join(tmpdir(), 'widgets-static-'));
    mkdirSync(join(staticDir, 'assets'));
    writeFileSync(join(staticDir, 'index.html'), INDEX_HTML);
    writeFileSync(join(staticDir, 'assets', 'index-abc123.js'), APP_JS);
  });

  afterAll(() => {
    rmSync(staticDir, { recursive: true, force: true });
  });

  const app = () => createApp({ staticDir, logger: { error: vi.fn() } });

  it('serves the SPA entry page at the root', async () => {
    const response = await request(app()).get('/');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/html/);
    expect(response.text).toBe(INDEX_HTML);
  });

  it('marks the entry page as revalidate-every-time so new builds are picked up', async () => {
    const response = await request(app()).get('/');

    expect(response.headers['cache-control']).toBe('no-cache');
  });

  it('serves hashed build assets with long-lived immutable caching', async () => {
    const response = await request(app()).get('/assets/index-abc123.js');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/javascript/);
    expect(response.text).toBe(APP_JS);
    expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('falls back to the entry page for unknown client-side routes', async () => {
    const response = await request(app()).get('/some/client/route');

    expect(response.status).toBe(200);
    expect(response.text).toBe(INDEX_HTML);
  });

  it('returns 404 for missing assets instead of the entry page', async () => {
    const response = await request(app()).get('/assets/missing.js');

    expect(response.status).toBe(404);
  });

  it('keeps API routes working alongside static hosting', async () => {
    const created = await request(app()).post('/api/widgets');
    expect(created.status).toBe(201);

    const health = await request(app()).get('/api/health');
    expect(health.body).toEqual({ status: 'ok' });
  });

  it('never shadows unknown API routes with the entry page', async () => {
    const response = await request(app()).get('/api/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('does not serve the entry page for non-GET requests', async () => {
    const response = await request(app()).post('/some/client/route');

    expect(response.status).toBe(404);
    expect(response.text).not.toBe(INDEX_HTML);
  });

  it('does not serve any static files when no static directory is configured', async () => {
    const response = await request(createApp({ logger: { error: vi.fn() } })).get('/');

    expect(response.status).toBe(404);
  });
});

import { describe, expect, it } from 'vitest';
import config from '../vite.config.js';

describe('vite dev server', () => {
  it('proxies API requests to the Widget Service so the app stays same-origin', () => {
    expect(config.server?.proxy).toEqual({
      '/api': { target: 'http://localhost:3001', changeOrigin: false },
    });
  });
});

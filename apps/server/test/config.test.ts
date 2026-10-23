import { describe, expect, it } from 'vitest';
import { resolveServerConfig } from '../src/config.js';

const noBuild = () => false;

describe('resolveServerConfig', () => {
  it('defaults to port 3001 and no static hosting', () => {
    expect(resolveServerConfig({ argv: [], env: {}, defaultStaticDir: '/x', hasWebBuild: noBuild })).toEqual({
      port: 3001,
    });
  });

  it('serves the default static directory when a web build exists there', () => {
    const config = resolveServerConfig({
      argv: [],
      env: {},
      defaultStaticDir: '/app/apps/web/dist',
      hasWebBuild: (dir) => dir === '/app/apps/web/dist',
    });

    expect(config).toEqual({ port: 3001, staticDir: '/app/apps/web/dist' });
  });

  it('reads PORT and STATIC_DIR from the environment', () => {
    const config = resolveServerConfig({
      argv: [],
      env: { PORT: '8080', STATIC_DIR: '/srv/web' },
      defaultStaticDir: '/x',
      hasWebBuild: noBuild,
    });

    expect(config).toEqual({ port: 8080, staticDir: '/srv/web' });
  });

  it('lets command-line flags override the environment', () => {
    const config = resolveServerConfig({
      argv: ['--port', '3000', '--static-dir', '/cli/web'],
      env: { PORT: '8080', STATIC_DIR: '/env/web' },
      defaultStaticDir: '/x',
      hasWebBuild: noBuild,
    });

    expect(config).toEqual({ port: 3000, staticDir: '/cli/web' });
  });

  it.each(['abc', '0', '-1', '70000', '30.5'])('rejects invalid port %j', (port) => {
    expect(() =>
      resolveServerConfig({ argv: [`--port=${port}`], env: {}, defaultStaticDir: '/x', hasWebBuild: noBuild }),
    ).toThrow(/Invalid port/);
  });
});

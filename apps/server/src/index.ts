import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { resolveServerConfig } from './config.js';

// Resolves to apps/web/dist both from src/ (dev via tsx) and dist/ (bundled build).
const defaultStaticDir = fileURLToPath(new URL('../../web/dist', import.meta.url));

const { port, staticDir } = resolveServerConfig({
  argv: process.argv.slice(2),
  env: process.env,
  defaultStaticDir,
  hasWebBuild: (dir) => existsSync(join(dir, 'index.html')),
});

const server = createApp(staticDir ? { staticDir } : {}).listen(port, () => {
  console.log(`Widget Service listening on http://localhost:${port}`);
  if (staticDir) console.log(`Serving web app from ${staticDir}`);
});

// Let in-flight requests finish when the container or dev runner stops us.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
  });
}

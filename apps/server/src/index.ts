import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3001);

const server = createApp().listen(port, () => {
  console.log(`Widget Service listening on http://localhost:${port}`);
});

// Let in-flight requests finish when the container or dev runner stops us.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
  });
}

import { parseArgs } from 'node:util';

export interface ServerConfig {
  port: number;
  /** When set, the built web app is served from this directory. */
  staticDir?: string;
}

export interface ConfigSources {
  argv: string[];
  env: Record<string, string | undefined>;
  /** Where the web build lives relative to the server, used when nothing else is configured. */
  defaultStaticDir: string;
  hasWebBuild: (dir: string) => boolean;
}

const DEFAULT_PORT = 3001;

/** Resolves configuration from CLI flags, then environment variables, then defaults. */
export function resolveServerConfig({ argv, env, defaultStaticDir, hasWebBuild }: ConfigSources): ServerConfig {
  const { values } = parseArgs({
    args: argv,
    options: { port: { type: 'string' }, 'static-dir': { type: 'string' } },
  });

  const port = parsePort(values.port ?? env.PORT);
  const staticDir =
    values['static-dir'] ?? env.STATIC_DIR ?? (hasWebBuild(defaultStaticDir) ? defaultStaticDir : undefined);

  return staticDir === undefined ? { port } : { port, staticDir };
}

function parsePort(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_PORT;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid port: ${raw}`);
  }
  return port;
}

# syntax=docker/dockerfile:1

# ---- deps: install the full workspace (dev deps included) for building and testing ----
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci

# ---- build: compile the web bundle and the server bundle ----
FROM deps AS build
COPY tsconfig.base.json vitest.config.ts ./
COPY packages packages
COPY apps apps
RUN npm run build

# ---- test: optional target, `docker build --target test .` runs the whole suite ----
FROM build AS test
RUN npm run typecheck && npm test

# ---- runtime: production dependencies + build output only, as a non-root user ----
FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    STATIC_DIR=/app/apps/web/dist
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --workspace @text-widgets/server && npm cache clean --force

COPY --from=build /app/apps/server/dist apps/server/dist
COPY --from=build /app/apps/web/dist apps/web/dist

USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:' + process.env.PORT + '/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

CMD ["node", "--enable-source-maps", "apps/server/dist/index.js"]

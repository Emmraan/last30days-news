# syntax=docker/dockerfile:1

FROM node:26.13.0-slim AS build
WORKDIR /app
# Node 26 does not bundle Corepack; install the pinned pnpm once.
RUN npm install --global pnpm@12.16.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY landing/package.json landing/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && pnpm build:landing

FROM node:26.13.0-slim AS runtime
ENV NODE_ENV=production \
    L30_DEPLOYED=1 \
    L30_DATA_DIR=/data \
    PORT=4477 \
    HOST=0.0.0.0
WORKDIR /app
RUN npm install --global pnpm@12.16.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY landing/package.json landing/
# The server bundle is self-contained; only production dependencies ship.
RUN pnpm install --prod --frozen-lockfile --ignore-scripts && pnpm store prune
COPY --from=build /app/build ./build
COPY --from=build /app/bin ./bin
COPY --from=build /app/README.md /app/LICENSE /app/CHANGELOG.md ./
COPY deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
 && mkdir -p /data \
 && chown -R node:node /app /data

USER node
VOLUME ["/data"]
EXPOSE 4477
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4477) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "bin/last30days.js", "--no-open"]

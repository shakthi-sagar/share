FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
ARG SHARE_SELF_HOST_ORIGIN=http://localhost:8787
ARG SHARE_SELF_HOST_MAX_BYTES=2147483648
RUN SHARE_PUBLIC_WEB_URL=$SHARE_SELF_HOST_ORIGIN \
    SHARE_PUBLIC_API_URL=$SHARE_SELF_HOST_ORIGIN \
    SHARE_PUBLIC_DEFAULT_EXPIRY_SECONDS=86400 \
    SHARE_PUBLIC_MAX_SHARE_BYTES=$SHARE_SELF_HOST_MAX_BYTES \
    pnpm --filter @share/web build
RUN pnpm --filter @share/api-node build && \
    pnpm --filter @share/api-node --prod deploy --legacy /out

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out/node_modules /app/node_modules
COPY --from=build --chown=node:node /app/apps/api-node/dist /app/server
COPY --from=build --chown=node:node /app/apps/api-cloudflare/migrations /app/migrations
COPY --from=build --chown=node:node /app/apps/web/dist /app/web
RUN install -d -o node -g node /app/data
ENV SHARE_NODE_WEB_ROOT=/app/web SHARE_NODE_MIGRATIONS=/app/migrations SHARE_NODE_DATABASE=/app/data/share.sqlite
EXPOSE 8787
USER node
CMD ["node", "/app/server/server.mjs"]

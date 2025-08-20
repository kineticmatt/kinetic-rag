# ---- build stage ----
FROM node:20-slim AS build
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# copy workspace manifests first (better Docker cache)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps ./apps
COPY packages ./packages
COPY migrations ./migrations

RUN pnpm install --frozen-lockfile
RUN pnpm -r build

# ---- runtime stage ----
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Install CA certificates so TLS validation works for Postgres/HTTPS
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# copy built app from the build stage
COPY --from=build /app /app

# default command is ignored by Fly when using [processes]
CMD ["node","apps/rag-api/dist/server.js"]
EXPOSE 8080

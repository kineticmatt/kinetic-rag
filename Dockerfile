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
# copy built app
COPY --from=build /app /app

# default command is ignored because we'll define processes in fly.toml
CMD ["node","apps/rag-api/dist/server.js"]
EXPOSE 8080

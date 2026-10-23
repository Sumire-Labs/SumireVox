FROM node:24.22.1-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY apps/admin/package.json apps/admin/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @sumirevox/admin...

FROM base AS build
COPY --from=deps /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/.npmrc ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/admin/node_modules ./apps/admin/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY packages/shared/ packages/shared/
COPY tsconfig.base.json ./
COPY apps/admin/ apps/admin/
RUN pnpm --filter @sumirevox/shared build
RUN pnpm --filter @sumirevox/admin build

FROM nginx:alpine AS runner
COPY --from=build /app/apps/admin/dist /usr/share/nginx/html
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

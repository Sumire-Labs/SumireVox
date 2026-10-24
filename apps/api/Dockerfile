FROM node:24.22.1-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
RUN apt-get update && apt-get install -y python3 make g++ libopus-dev && rm -rf /var/lib/apt/lists/*
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/bot/package.json apps/bot/
COPY packages/shared/package.json packages/shared/
RUN PRISMA_SKIP_POSTINSTALL_GENERATE=true pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/apps/bot/node_modules ./apps/bot/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY packages/shared/ packages/shared/
COPY apps/bot/prisma/ apps/bot/prisma/
COPY apps/bot/prisma.config.ts apps/bot/prisma.config.ts
COPY apps/api/ apps/api/
COPY --from=deps /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/.npmrc ./
COPY tsconfig.base.json ./
RUN pnpm --filter @sumirevox/shared build
RUN ./apps/bot/node_modules/.bin/prisma generate --config=apps/bot/prisma.config.ts
RUN pnpm --filter @sumirevox/api build

FROM base AS runner
COPY scripts/check-node-runtime.mjs /app/scripts/
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/apps/bot/prisma ./apps/bot/prisma
COPY --from=build /app/apps/bot/prisma.config.ts ./apps/bot/prisma.config.ts
ENV NODE_ENV=production
WORKDIR /app/apps/api
CMD ["node", "dist/index.js"]

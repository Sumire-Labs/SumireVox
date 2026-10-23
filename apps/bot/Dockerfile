FROM node:24.22.1-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
RUN apt-get update && apt-get install -y openssl ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
RUN apt-get update && apt-get install -y python3 make g++ libopus-dev && rm -rf /var/lib/apt/lists/*
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY apps/bot/package.json apps/bot/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/bot/node_modules ./apps/bot/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY packages/shared/ packages/shared/
COPY apps/bot/ apps/bot/
COPY --from=deps /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/.npmrc ./
COPY tsconfig.base.json ./
RUN pnpm --filter @sumirevox/shared build
RUN pnpm --filter @sumirevox/bot exec prisma generate
RUN pnpm --filter @sumirevox/bot build

FROM base AS migrate
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/bot/node_modules ./apps/bot/node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/apps/bot/package.json ./apps/bot/
COPY --from=build /app/apps/bot/prisma ./apps/bot/prisma
ENV NODE_ENV=production
WORKDIR /app/apps/bot
CMD ["npx", "prisma", "migrate", "deploy"]

FROM base AS runner
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/bot/node_modules ./apps/bot/node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/apps/bot/dist ./apps/bot/dist
COPY --from=build /app/apps/bot/package.json ./apps/bot/
COPY --from=build /app/apps/bot/prisma ./apps/bot/prisma
COPY --from=build /app/apps/bot/assets ./apps/bot/assets
ENV NODE_ENV=production
WORKDIR /app/apps/bot
CMD ["node", "dist/index.js"]

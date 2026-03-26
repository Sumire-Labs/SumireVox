FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/bot/package.json apps/bot/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/bot/node_modules ./apps/bot/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY packages/shared/ packages/shared/
COPY apps/bot/ apps/bot/
RUN pnpm --filter @sumirevox/shared build
RUN cd apps/bot && npx prisma generate
RUN pnpm --filter @sumirevox/bot build

FROM base AS migrate
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/bot/node_modules ./apps/bot/node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/apps/bot/package.json ./apps/bot/
COPY --from=build /app/apps/bot/prisma ./apps/bot/prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
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
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
ENV NODE_ENV=production
WORKDIR /app/apps/bot
CMD ["node", "dist/index.js"]

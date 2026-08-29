# SumireVox

VOICEVOX 読み上げ Discord Bot、Hono API、React ダッシュボードの pnpm workspace。

## 作業前

- 返答は日本語。実装前に対象の `docs/*.md` とパスに対応する `.claude/rules/*.md` を確認し、仕様と scripts/config が食い違う場合は実行設定を優先する。
- Node.js 22 / pnpm 9.15.9 を使い、コマンドはリポジトリルートから実行する。新機能の仕様変更は対応する docs を先に更新する。

## Workspace

- `apps/bot`: `src/index.ts` が `ShardingManager` として `bot.ts` をシャード子プロセスで起動する。依存方向は `commands -> services -> infrastructure`。Prisma スキーマは `apps/bot/prisma/schema.prisma`。
- `apps/api`: `src/index.ts` が `src/app.ts` の Hono アプリを起動し、Bot と同じ Prisma スキーマを使う。
- `apps/web` / `apps/admin`: 共通 UI パッケージを持たない独立 Vite SPA。開発ポートは 5173 / 5174、`/api` と `/auth` は `localhost:3000` にプロキシする。
- `packages/shared`: 共有型・定数・ユーティリティ。exports は `dist` を向くため、単体で依存パッケージをビルドするときは先に `pnpm --filter @sumirevox/shared build` を実行する。

## Commands

```bash
pnpm run setup
docker compose up -d postgres redis voicevox
pnpm db:migrate:dev
pnpm db:generate
pnpm dev:bot       # BOT_INSTANCE_ID の既定値は 1
pnpm dev:bot:2     # :1 / :2 / :3 でインスタンスを選択
pnpm dev:api       # API: 3000
pnpm dev:web       # Web: 5173
pnpm dev:admin     # Admin: 5174
pnpm build
pnpm test
pnpm --filter @sumirevox/bot test -- src/services/__tests__/premium-service.test.ts
```

- `pnpm deploy-commands` はインスタンス 1。`DEPLOY_GUILD_ID` 設定時はギルド登録、未設定時はグローバル登録。別インスタンスは `pnpm deploy-commands:2` / `:3` を使う。
- `pnpm lint` は root wrapper だけで、各 package に lint script/config はない。型チェック・ビルドは `pnpm build` で確認する。
- Vitest の対象は bot/api/shared。Node 環境・globals 有効で、bot/api は `@sumirevox/shared` を source に alias する。Discord、VOICEVOX、Redis、Prisma など外部依存はモックする。

## 生成・CI

- Prisma Client は `apps/bot/prisma/schema.prisma` から生成する。CI は `PRISMA_SKIP_POSTINSTALL_GENERATE=true` で install し、Dockerfile は build 中に generate を明示実行するため、生成物がないときやスキーマ変更後は `pnpm db:generate` を実行する。Prisma CLI を直接呼ぶ場合は `pnpm --filter @sumirevox/bot exec prisma ...` を使う。
- CI の検証順は `pnpm install --frozen-lockfile` -> Prisma generate -> shared build -> `pnpm audit --prod --audit-level=high` -> `pnpm test` -> `pnpm build`。Pages は test 後に対象 SPA を build/deploy する。

## 実装上の不変条件

- TypeScript は strict。`any`、実行時コードの `console.log` / `console.error`、アプリケーションコードの default export は使わず、pino の logger と named export を使う（既存の Vite/Vitest config の default export は例外）。
- `process.env` は `infrastructure/config.ts` または共有ヘルパーに集約し、エラーは `AppError` を使う。新規ファイルは kebab-case、ドメインの `index.ts` は re-export 専用（`apps/*/src/index.ts` の実行エントリポイントは例外）。
- 設定・辞書・ユーザー音声設定などの DB 更新後は、`packages/shared/src/constants/redis-channels.ts` の Redis Pub/Sub を発行して全プロセスのキャッシュを無効化する。
- API の通常応答は `{ success, data }` / `{ success: false, error: { code, message } }`。Stripe webhook は raw body で署名検証するため、`sessionMiddleware` より前のマウント順を変えない。

## 環境・デプロイ

- Bot/API 開発はルート `.env` を読み、Vite も `envDir: ../../` のため `VITE_*` はルート `.env` に置く。Bot は `BOT_INSTANCE_ID=N` に対応する `DISCORD_TOKEN_N` / `DISCORD_CLIENT_ID_N`、API OAuth はサフィックスなしの `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` を使う。
- `docker-compose.yml` は `POSTGRES_PASSWORD` と `REDIS_PASSWORD` が必須で、VOICEVOX は既定で NVIDIA イメージ。GPU なしは `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis voicevox` を使う。
- ローカルの production profile は `docker compose --profile production up -d --build`。`docker-compose.prod.yml` は GHCR の既成イメージを使う別構成なので混同しない。
- Docker image / Cloudflare Pages の実際の順序と build-time `VITE_*` は `.github/workflows/deploy.yml` と `.github/workflows/cloudflare-pages.yml` を確認する。

## 参照

- 詳細規約は `.claude/rules/*.md`、仕様の中心は `docs/{architecture,database,api-endpoints,env-vars,commands,text-pipeline,boost-system}.md`。
- `docs/voice-synthesis.md` は空なので、音声合成は `apps/bot/src/services` と `apps/bot/src/infrastructure/voicevox-client.ts` を確認する。HeroUI は React v3 のため、利用可能なら `.heroui-docs/react`、なければ公式 v3 docs を確認する。
- コミットは `<type>: <description>`（`feat`, `fix`, `docs` など）の形式で、完了した変更を検証後にコミットする。

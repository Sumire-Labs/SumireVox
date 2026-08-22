# SumireVox

VOICEVOX 読み上げ Discord Bot、Hono API、React ダッシュボードの pnpm workspace。

## 作業ルール

- ユーザーへの返答は日本語。実装前に対象の `docs/*.md` と該当する `.claude/rules/*.md` を確認し、仕様書と実行設定が食い違う場合は実行設定を優先する。
- Node.js 22 / pnpm 9.15.9 を使用し、コマンドはリポジトリルートから実行する。
- TypeScript は strict。`any`、実行時コードの `console.log`/`console.error`、default export は使わず、pino の logger と named export を使う。ただし既存の Vite/Vitest 設定の default export は変更しない。
- `process.env` の参照は `infrastructure/config.ts` または共有ヘルパーに集約し、アプリケーションコードで直接読まない。エラーは `AppError` を使う。
- 新規ファイルは kebab-case。ドメインの `index.ts` は re-export 専用だが、`apps/*/src/index.ts` の実行エントリポイントは例外。

## 境界とエントリポイント

- `apps/bot`: `src/index.ts` が `ShardingManager` として `bot.ts` をシャード子プロセスで起動する。Bot の依存方向は `commands → services → infrastructure`。Prisma スキーマも `apps/bot/prisma/schema.prisma` にある。
- `apps/api`: `src/index.ts` が `src/app.ts` の Hono アプリを起動する。Bot と同じ Prisma スキーマを使う。
- `apps/web` と `apps/admin`: 共通 UI パッケージを持たない独立 Vite SPA。開発ポートはそれぞれ 5173 / 5174 で、`/api` と `/auth` を localhost:3000 にプロキシする。
- `packages/shared`: 共有型・定数・ユーティリティ。公開先は `dist` なので、単体ビルドでは先に `pnpm --filter @sumirevox/shared build` を実行する。

## 開発・検証コマンド

```bash
# 初回: .env 作成（既存なら保持）→ install → Prisma Client 生成
pnpm run setup

# .env の POSTGRES_PASSWORD / REDIS_PASSWORD 設定後
docker compose up -d postgres redis voicevox
pnpm db:migrate:dev

# NVIDIA GPU がない場合（GPU reservation も無効化）
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis voicevox

pnpm dev:bot       # BOT_INSTANCE_ID の既定値は 1
pnpm dev:bot:2     # インスタンス 2（:1 / :3 も可）
pnpm dev:api
pnpm dev:web       # 5173
pnpm dev:admin     # 5174

pnpm build
pnpm test
pnpm --filter @sumirevox/bot test -- src/services/__tests__/premium-service.test.ts
```

- CI/Docker は `PRISMA_SKIP_POSTINSTALL_GENERATE=true` で install するため Prisma Client が生成されない。スキーマ変更後、または生成物がない状態では `pnpm db:generate` を先に実行する。Prisma CLI は Bot workspace にあるため、直接使う場合は `pnpm --filter @sumirevox/bot exec prisma ...` とする。
- `pnpm lint` は root wrapper のみで、各 package に lint script/config はない。lint 成功を品質確認とみなさず、型チェック・ビルドは `pnpm build` で行う。
- Docker CI（`deploy.yml`）は `PRISMA_SKIP_POSTINSTALL_GENERATE=true` で install し、Prisma generate → shared build → audit → test → build の順で実行する。Pages workflow も generate/shared build/audit/test 後に対象 SPA を build/deploy する。
- Discord コマンド登録は `pnpm deploy-commands`。`DEPLOY_GUILD_ID` 設定時はギルド登録、未設定時はグローバル登録。別インスタンスは `pnpm deploy-commands:2` / `:3` を使う。
- 本番用のローカル Compose は `docker compose --profile production up -d --build`。CI の Docker/Pages デプロイ詳細は `.github/workflows/deploy.yml` と `cloudflare-pages.yml` を確認する。

## 実行時の注意

- Bot/API はルート `.env` を読む。Vite も `envDir: ../../` なので Web/Admin の `VITE_*` はルート `.env` に置く。Bot は `BOT_INSTANCE_ID=N` に対応する `DISCORD_TOKEN_N` / `DISCORD_CLIENT_ID_N`、API の OAuth はサフィックスなしの `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` を使う。全変数は `docs/env-vars.md` を参照する。
- `docker-compose.yml` は `POSTGRES_PASSWORD` と `REDIS_PASSWORD` が空だと起動しない。VOICEVOX は既定で NVIDIA イメージ、GPU なしの開発は上記の `docker-compose.dev.yml` overlay を使う。
- 設定・辞書・ユーザー音声設定など DB 更新後は、`packages/shared/src/constants/redis-channels.ts` のチャンネルで Redis Pub/Sub を発行し、全プロセスのキャッシュを無効化する。
- API の通常応答は `{ success, data }` / `{ success: false, error: { code, message } }`。Stripe webhook は署名検証のため raw body が必要で、セッション middleware より前にマウントされている順序を壊さない。
- Vitest は Node 環境・globals 有効。Bot/API のテストでは `@sumirevox/shared` を source に alias するが、外部依存（Discord、VOICEVOX、Redis、Prisma）はモックする。
- HeroUI は React v3。UI API は記憶で推測せず、利用可能な `.heroui-docs/react` または公式 v3 ドキュメントを確認する（`.heroui-docs/` は git 管理外）。
- `docs/voice-synthesis.md` は現在空なので、音声合成の実装確認には `apps/bot/src/services` と VOICEVOX client を使う。

## 参照先

- パス別の詳細規約: `.claude/rules/{typescript,file-structure,bot,api,frontend}.md`。
- 仕様の中心: `docs/{architecture,database,api-endpoints,env-vars,commands,text-pipeline,boost-system}.md`。
- より詳しい既存メモは `README.md` / `CLAUDE.md` にあるが、scripts・package.json・CI・実コードを最終的な根拠とする。

## Additional Agent Instructions

### Specification Maintenance

- Every new feature must be documented in the project's specification or documentation.
- When a task introduces a specification change, update the relevant specification before making any corresponding code changes.
- Specification changes must precede implementation changes.

### Git Commit Policy

- Make commits frequently and keep them granular.
- Create separate commits at meaningful feature, fix, refactor, or other logical work-unit boundaries.
- Prefer multiple small, focused commits over one large commit containing unrelated or loosely related changes.
- Before reporting that the requested work is complete, always commit all completed work.
- Do not send the final completion report while completed changes remain uncommitted.

### Conflicts Between Specifications and User Instructions

- If an existing specification conflicts with the user's current prompt or instructions, the user's current instructions take precedence.
- Do not stop work merely because such a discrepancy exists.
- Continue the work according to the user's instructions.
- Where necessary, update the specification first so that it reflects the user's requested changes before modifying the codebase.
- Inform the user that the previous specification and the user's instructions differed.
- If multiple specification differences or changes are discovered during the task, do not report them individually as they are found.
- First identify and compare all relevant specification differences, then report them together in a single consolidated explanation.

### Language Used in Agent-User Communication

- All content that the user is expected or required to read must be written in Japanese.
- This applies specifically to communication between the development agent and the user during development, including progress updates, questions, warnings, explanations, completion reports, and other user-facing messages.
- This communication-language rule must not alter or impose language requirements on the product being developed. The product's UI, source code, documentation, localization, and other language choices must continue to follow the project's requirements and specifications.
- Content that the user does not need to read may use languages other than Japanese when doing so is more appropriate or improves quality.
- Internal agent instructions, reasoning artifacts, implementation notes not shown to the user, and instructions to sub-agents may use English or another language when that is more effective.
- Instructions to sub-agents do not need to be written in Japanese if another language is expected to produce higher-quality results.

# SumireVox — Discord 読み上げ Bot

Discord の VC に接続し、テキストチャンネルのメッセージを VOICEVOX で音声合成して読み上げる Bot。Web ダッシュボードと Stripe によるブースト課金システムを備える。

## 技術スタック

- 言語: TypeScript (strict mode)
- ランタイム: Node.js + tsx
- パッケージマネージャー: pnpm (workspace)
- Discord: discord.js + @discordjs/voice + @discordjs/opus
- 音声合成: VOICEVOX ENGINE (HTTP API)
- DB: PostgreSQL + Prisma
- キャッシュ/Pub/Sub: Redis
- API: Hono
- フロントエンド: React + Vite + HeroUI + Tailwind CSS + React Router
- 決済: Stripe
- リバースプロキシ: nginx + Let's Encrypt
- テスト: Vitest
- ロガー: pino
- インフラ: docker-compose (8サービス)

## プロジェクト構成

```
apps/
  bot/            # Discord Bot (ShardingManager + シャード)
  api/            # Hono API サーバー
  web/            # メインサイト (sumirevox.com)
  admin/          # 管理者ダッシュボード (admin.sumirevox.com)
packages/
  shared/         # 型定義、定数、ユーティリティ
```

## ビルド・実行コマンド

- `pnpm install` — 依存インストール
- `pnpm run build` — 全パッケージビルド
- `pnpm run dev` — 開発サーバー起動
- `pnpm run deploy-commands` — スラッシュコマンドを Discord に登録 (`DEPLOY_GUILD_ID` 設定時はギルドコマンド、未設定時はグローバル)
- `pnpm run test` — Vitest でテスト実行
- `pnpm run test:watch` — テストをウォッチモードで実行
- `pnpm -F bot run dev` — Bot のみ起動
- `pnpm -F api run dev` — API サーバーのみ起動
- `pnpm -F web run dev` — メインサイト開発サーバー
- `pnpm -F admin run dev` — 管理者ダッシュボード開発サーバー
- `pnpm -F shared run build` — shared パッケージビルド
- `npx prisma migrate dev` — マイグレーション作成・実行
- `npx prisma generate` — Prisma Client 生成
- `docker compose up` — 全サービス起動 (本番)
- `docker compose up -d postgres redis voicevox` — 開発用に DB/Redis/VOICEVOX のみ起動

## 仕様書リファレンス

IMPORTANT: 実装時は必ず以下の仕様書を参照すること。

- アーキテクチャ全体: @docs/architecture.md
- コマンド仕様: @docs/commands.md
- テキスト前処理: @docs/text-pipeline.md
- 音声合成: @docs/voice-synthesis.md
- データモデル: @docs/database.md
- API エンドポイント: @docs/api-endpoints.md
- ブースト課金: @docs/boost-system.md
- Web フロントエンド: @docs/web-frontend.md
- 環境変数: @docs/env-vars.md
- 将来拡張: @docs/future-plans.md

## 重要な設計原則

- 依存方向は `commands → services → infrastructure` の一方向。逆方向禁止
- 1ファイル1エクスポート。ファイル名は kebab-case (例: `create-audio-resource.ts`)
- `any` 禁止。`console.log` 禁止 (pino の logger を使う)
- `process.env` の直接参照禁止 (`config.ts` で一元管理)
- default export 禁止。named export のみ
- `index.ts` は re-export のみ。ロジック禁止
- エラーは `AppError` カスタムエラークラスで統一
- テスト: コアロジックのユニットテストを Vitest で書く。外部依存はモック

## テスト実行

- 単一テスト: `pnpm run test -- path/to/file.test.ts`
- 全テスト: `pnpm run test`
- テスト変更時は必ず実行して通ることを確認する

## 注意事項

### ファイル名の大文字小文字
- Linux CI（GitHub Actions）はファイル名の大文字小文字を区別する
- `main.tsx` でのインポートとファイル名の casing を必ず一致させること
- 例: `import App from './App'` なら `App.tsx`、`import App from './app'` なら `app.tsx`
- ファイル名を変更する場合は `git mv` を使うこと（OS上のリネームだけでは Git が追跡しない場合がある）

### ビルド順序
- `@sumirevox/shared` は他のパッケージより先にビルドする必要がある
- Prisma Client は `pnpm --filter @sumirevox/bot exec prisma generate` で明示的に生成する（`PRISMA_SKIP_POSTINSTALL_GENERATE=true` を使用しているため）
- CI およびDockerfile で `pnpm build` する前に上記2つが完了していること

### pnpm ワークスペース
- Prisma CLI は `apps/bot/node_modules/.bin/prisma` にある（root にホイストされない）
- `node_modules/.prisma` は root に存在しない（`.pnpm` 配下にある）

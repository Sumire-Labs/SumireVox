# SumireVox

VOICEVOX エンジンを使った Discord 読み上げ Bot。

## 必要環境

- Node.js 22+
- pnpm 9+
- Docker & Docker Compose
- Discord Bot Token（[Discord Developer Portal](https://discord.com/developers/applications)）

## セットアップ

### 1. リポジトリクローン & 初期設定

```bash
git clone <repo-url>
cd sumirevox
pnpm run setup
```

### 2. 環境変数の設定

`.env` ファイルを開き、以下を設定:

- `DISCORD_TOKEN` — Bot トークン
- `DISCORD_CLIENT_ID` — アプリケーション ID
- `DISCORD_CLIENT_SECRET` — OAuth2 クライアントシークレット

### 3. インフラ起動（PostgreSQL, Redis, VOICEVOX）

```bash
docker compose up -d
```

### 4. データベースマイグレーション

```bash
pnpm db:migrate:dev
```

### 5. コマンド登録

```bash
pnpm deploy-commands
```

### 6. Bot 起動

```bash
pnpm dev:bot
```

### 7. API サーバー起動（別ターミナル）

```bash
pnpm dev:api
```

### 8. Web サイト起動（別ターミナル）

```bash
pnpm dev:web
```

## 本番デプロイ

```bash
docker compose --profile production up -d --build
```

## プロジェクト構成

```
sumirevox/
├── apps/
│   ├── bot/       — Discord Bot（discord.js + @discordjs/voice）
│   ├── api/       — REST API（Hono）
│   ├── web/       — Web サイト & ダッシュボード（Vite + React）
│   └── admin/     — 管理者ダッシュボード（Vite + React）
├── packages/
│   └── shared/    — 共有型定義・定数・ユーティリティ
├── nginx/         — リバースプロキシ設定
└── docker-compose.yml
```

## コマンド一覧

| コマンド | 説明 |
|---------|------|
| `pnpm dev:bot` | Bot 開発サーバー起動 |
| `pnpm dev:api` | API 開発サーバー起動 |
| `pnpm dev:web` | Web 開発サーバー起動 |
| `pnpm dev:admin` | Admin 開発サーバー起動 |
| `pnpm deploy-commands` | Discord コマンド登録 |
| `pnpm db:migrate:dev` | DB マイグレーション（開発） |
| `pnpm db:studio` | Prisma Studio 起動 |
| `pnpm build` | 全パッケージビルド |
| `pnpm test` | 全テスト実行 |

## ライセンス

MIT

## クレジット

音声合成には [VOICEVOX](https://voicevox.hiroshiba.jp/) を使用しています。

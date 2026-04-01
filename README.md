# SumireVox

VOICEVOX エンジンを使った Discord 読み上げ Bot。Web ダッシュボードと Stripe によるブースト課金システムを備える。

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-5FA04E?logo=nodedotjs&logoColor=white)
![Discord.js](https://img.shields.io/badge/Discord.js-5865F2?logo=discord&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)
![Hono](https://img.shields.io/badge/Hono-E36002?logo=hono&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-FF4438?logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)

## Features

- **VOICEVOX による高品質な音声合成** — GPU (NVIDIA CUDA) 対応の VOICEVOX ENGINE を使用
- **スラッシュコマンドで簡単操作** — `/join` `/leave` `/voice` `/settings` `/dictionary` `/help`
- **サーバー辞書 & グローバル辞書** — 最長一致トライ木による高速変換
- **Web ダッシュボードでの設定管理** — サーバー設定・辞書管理を GUI で操作
- **Stripe によるブースト課金** — 月額300円/1ブーストで PREMIUM 機能を解放
- **マルチ Bot インスタンス対応** — `BOT_INSTANCE_ID` で複数 Bot を並列運用
- **自動接続 & 入退室通知** — VC への自動参加と入退室アナウンス
- **ユーザーごとの音声設定** — 話者・速度・ピッチを個別にカスタマイズ

## FREE vs PREMIUM

| 機能 | FREE | PREMIUM |
|---|---|---|
| 読み上げ最大文字数 | 50 文字 | 200 文字 |
| ユーザー設定（話者 / 速度 / ピッチ）適用 | ✗ | ✓ |
| 複数チャンネル読み上げ | ✗ | ✓（将来） |
| サーバー辞書エントリ上限 | 10 件 | 100 件 |

PREMIUM への移行時に DB 上の設定値は保持されます。FREE に戻った場合も辞書エントリは削除されませんが、上限超過時は新規追加が禁止されます。

## コマンド一覧

| コマンド | 説明 |
|---|---|
| `/join` | VC に参加し、コマンド実行チャンネルを読み上げ対象に設定 |
| `/leave` | VC から退出（キューをクリアして即座に退出） |
| `/voice` | ユーザー単位の音声設定を変更（話者・速度・ピッチ）、全サーバー共通 |
| `/settings` | サーバー単位の設定を変更（`ManageGuild` 権限または管理ロール必須） |
| `/dictionary` | サーバー辞書とグローバル辞書の閲覧・管理・申請 |
| `/help` | コマンド一覧と概要を表示 |

## プロジェクト構成

```
sumirevox/
├── apps/
│   ├── bot/        — Discord Bot（ShardingManager + シャード、discord.js + @discordjs/voice）
│   ├── api/        — REST API サーバー（Hono）
│   ├── web/        — メインサイト（sumirevox.com、Vite + React）
│   └── admin/      — 管理者ダッシュボード（admin.sumirevox.com、Vite + React）
├── packages/
│   └── shared/     — 共有型定義・定数・ユーティリティ
├── docs/           — 仕様書（アーキテクチャ・コマンド・API 等）
├── nginx/          — リバースプロキシ設定
└── docker-compose.yml
```

## 技術スタック

| カテゴリ | 技術 |
|---|---|
| 言語 | TypeScript (strict mode) |
| ランタイム | Node.js + tsx |
| パッケージマネージャー | pnpm (workspace) |
| Discord | discord.js v14 + @discordjs/voice + @discordjs/opus |
| 音声合成 | VOICEVOX ENGINE (HTTP API) |
| DB | PostgreSQL 16 + Prisma |
| キャッシュ / Pub/Sub | Redis 7 |
| API | Hono |
| フロントエンド | React + Vite + HeroUI + Tailwind CSS + React Router |
| 決済 | Stripe |
| リバースプロキシ | nginx + Let's Encrypt (certbot) |
| テスト | Vitest |
| ロガー | pino |
| インフラ | Docker Compose |

## 必要環境

- Node.js 22+
- pnpm 9+
- Docker & Docker Compose
- Discord Bot Token（[Discord Developer Portal](https://discord.com/developers/applications)）
- NVIDIA GPU（VOICEVOX の GPU 推論を使う場合。CPU 版を使う場合は `docker-compose.yml` の `voicevox` イメージを `voicevox/voicevox_engine:cpu-latest` に変更）

## セットアップ

### 1. リポジトリクローン & 初期設定

```bash
git clone <repo-url>
cd sumirevox
pnpm run setup
```

`pnpm run setup` は `.env` の雛形生成 → 依存インストール → Prisma Client 生成を一括で行います。

### 2. 環境変数の設定

生成された `.env` を編集します。

**Bot（必須）:**

```env
# Bot インスタンス 1
DISCORD_TOKEN_1=your_bot_token_here
DISCORD_CLIENT_ID_1=your_bot_client_id_here

# 複数インスタンスを運用する場合はサフィックスの番号を増やして追加
# DISCORD_TOKEN_2=...
# DISCORD_CLIENT_ID_2=...
```

**API（OAuth2 / 必須）:**

```env
# API サーバーの OAuth2 設定（サフィックスなし）
DISCORD_CLIENT_ID=your_oauth2_client_id_here
DISCORD_CLIENT_SECRET=your_oauth2_client_secret_here
SESSION_SECRET=random_secret_string
CORS_ORIGIN=http://localhost:5173,http://localhost:5174
```

**Bot 管理者（必須）:**

```env
BOT_ADMIN_USER_IDS=your_discord_user_id
GLOBAL_DICT_NOTIFICATION_CHANNEL_ID=your_channel_id
```

**Stripe（空文字で Stripe 機能を無効化）:**

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
```

主な環境変数の一覧は [docs/env-vars.md](docs/env-vars.md) を参照してください。

### 3. インフラ起動（PostgreSQL, Redis, VOICEVOX）

```bash
docker compose up -d postgres redis voicevox
```

### 4. データベースマイグレーション

```bash
pnpm db:migrate:dev
```

### 5. Prisma Client 生成（スキーマ変更後に必要）

```bash
pnpm db:generate
```

### 6. Discord コマンド登録

```bash
# グローバルコマンド（反映に最大1時間）
pnpm deploy-commands

# 特定ギルドに即時反映したい場合は .env に DEPLOY_GUILD_ID を設定してから実行
pnpm deploy-commands:1
```

### 7. 各サービス起動

```bash
# Bot（インスタンス 1）
pnpm dev:bot

# API サーバー（別ターミナル）
pnpm dev:api

# メインサイト（別ターミナル）
pnpm dev:web

# 管理者ダッシュボード（別ターミナル）
pnpm dev:admin
```

## スクリプト一覧

| スクリプト | 説明 |
|---|---|
| `pnpm dev:bot` | Bot 開発サーバー起動（`BOT_INSTANCE_ID=1`） |
| `pnpm dev:bot:1` | Bot インスタンス 1 起動 |
| `pnpm dev:bot:2` | Bot インスタンス 2 起動 |
| `pnpm dev:bot:3` | Bot インスタンス 3 起動 |
| `pnpm dev:api` | API 開発サーバー起動 |
| `pnpm dev:web` | メインサイト開発サーバー起動 |
| `pnpm dev:admin` | 管理者ダッシュボード開発サーバー起動 |
| `pnpm build` | 全パッケージビルド |
| `pnpm test` | 全テスト実行（Vitest） |
| `pnpm lint` | 全パッケージ lint 実行 |
| `pnpm deploy-commands` | Discord コマンド登録（インスタンス 1） |
| `pnpm deploy-commands:1` | Discord コマンド登録（インスタンス 1） |
| `pnpm deploy-commands:2` | Discord コマンド登録（インスタンス 2） |
| `pnpm deploy-commands:3` | Discord コマンド登録（インスタンス 3） |
| `pnpm db:migrate:dev` | Prisma マイグレーション作成・実行（開発） |
| `pnpm db:migrate:deploy` | Prisma マイグレーション適用（本番） |
| `pnpm db:studio` | Prisma Studio 起動 |
| `pnpm db:generate` | Prisma Client 生成 |
| `pnpm setup` | 初期セットアップ（.env 生成 + install + generate） |

## 本番デプロイ

```bash
docker compose --profile production up -d --build
```

`production` プロファイルで起動するサービス:

| サービス | 役割 |
|---|---|
| `migrate` | `prisma migrate deploy` を実行して終了（最大3回リトライ） |
| `bot` | Discord Bot 本体（インスタンス 1） |
| `bot2` | Discord Bot 本体（インスタンス 2） |
| `api` | Hono API サーバー |
| `web` | メインサイト静的配信 |
| `admin` | 管理者ダッシュボード静的配信 |
| `nginx` | リバースプロキシ、HTTPS 終端 |
| `certbot` | Let's Encrypt 証明書の取得・自動更新 |

`migrate` サービスが正常終了した後に `bot` / `bot2` / `api` が起動します（`depends_on: condition: service_completed_successfully`）。

プロファイルなし（`postgres` / `redis` / `voicevox`）は `restart: unless-stopped` で常時稼働します。

## アーキテクチャ概要

### シャーディング

discord.js の `ShardingManager` 方式。Bot エントリポイントが `ShardingManager` として動作し、子プロセスとしてシャードを spawn します。シャード数は `'auto'`（Discord の推奨値）。

### Bot ↔ API 間通信

- 同一 PostgreSQL を Prisma 経由で共有
- リアルタイム通知（設定変更・辞書更新）は Redis Pub/Sub
- DB 更新後に必ず Pub/Sub イベントを発行し、全プロセスのキャッシュを一貫更新

### VC セッション管理

- メモリ上の Map で高速参照（guildId → 接続情報）
- Redis にも接続情報を記録し、シャード再起動時に自動再参加

### Graceful Shutdown

SIGTERM 受信 → 再生中の音声を中断 → 全キュークリア → 全 VC 切断 → プロセス終了。

## ドキュメント

| ドキュメント | 内容 |
|---|---|
| [docs/architecture.md](docs/architecture.md) | アーキテクチャ全体・Docker 構成・シャーディング |
| [docs/commands.md](docs/commands.md) | スラッシュコマンド仕様 |
| [docs/text-pipeline.md](docs/text-pipeline.md) | テキスト前処理パイプライン |
| [docs/voice-synthesis.md](docs/voice-synthesis.md) | 音声合成の詳細 |
| [docs/database.md](docs/database.md) | データモデル（Prisma スキーマ） |
| [docs/api-endpoints.md](docs/api-endpoints.md) | API エンドポイント一覧 |
| [docs/boost-system.md](docs/boost-system.md) | ブースト課金システム |
| [docs/web-frontend.md](docs/web-frontend.md) | Web フロントエンド構成 |
| [docs/env-vars.md](docs/env-vars.md) | 環境変数一覧 |
| [docs/future-plans.md](docs/future-plans.md) | 将来拡張計画 |

## ライセンス

GPL-3.0 license

## クレジット

音声合成には [VOICEVOX](https://voicevox.hiroshiba.jp/) を使用しています。

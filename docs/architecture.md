# アーキテクチャ

## docker-compose 構成 (8サービス)

| サービス | イメージ | 役割 |
|---|---|---|
| nginx | nginx:alpine | リバースプロキシ、静的ファイル配信、HTTPS 終端 |
| migrate | Node.js 24-alpine (自前ビルド) | `prisma migrate deploy` を実行して終了する一時サービス。最大3回リトライ |
| bot | Node.js 24-alpine (自前ビルド) | Discord Bot 本体。migrate 完了後に起動 |
| api | Node.js 24-alpine (自前ビルド) | Hono API サーバー。migrate 完了後に起動 |
| voicevox | voicevox/voicevox_engine (CUDA版) | 音声合成エンジン。runtime: nvidia |
| postgres | postgres:16-alpine | PostgreSQL。ボリューム永続化 |
| redis | redis:7-alpine | キャッシュ/Pub/Sub。maxmemory + allkeys-lru。ボリューム永続化 |
| certbot | certbot/certbot | Let's Encrypt 証明書取得・更新 |

全サービスに `restart: unless-stopped`（migrate と certbot を除く）。migrate は `restart: "no"`、bot と api は `depends_on: migrate: condition: service_completed_successfully`。

## シャーディング

discord.js の `ShardingManager` 方式。bot サービスのエントリポイントが ShardingManager で、子プロセスとしてシャードを spawn する。シャード数は `'auto'`。

音声合成の同時実行数はシャード単位で制御: `MAX_CONCURRENT_SYNTHESIS_GLOBAL` ÷ シャード数 = 各シャードのローカルセマフォ上限。

## Bot ↔ API サーバー間通信

- 同一 PostgreSQL を Prisma 経由で共有
- リアルタイム通知は Redis Pub/Sub (設定変更、辞書更新など)
- DB 更新後に必ず Pub/Sub イベント発行 → 全プロセスのキャッシュを一貫更新

## Redis の3つの役割

1. **Pub/Sub**: Bot ↔ API、シャード間のリアルタイム通知。辞書更新時はトライ木の無効化フラグのみ立て、再構築は次回アクセス時に遅延実行
2. **セッションストア**: Web の Discord OAuth2 セッション。TTL 7日
3. **設定キャッシュ**: GuildSettings / UserVoiceSetting を Redis キャッシュ。TTL は `SETTINGS_CACHE_TTL_SECONDS`

Redis 停止時はサービス停止を許容。フォールバックなし。`restart: unless-stopped` で自動復旧。

## VC セッション管理

- メモリ上の Map で高速参照 (guildId → { voiceChannelId, textChannelId, ... })
- Redis にも接続情報を記録
- シャード再起動時に Redis から前回の接続情報を読み取り、自動で VC 再参加

## PostgreSQL 接続数管理

Prisma の `DATABASE_URL` に `?connection_limit=N` を付与。シャードプロセス: `connection_limit=3`、API サーバー: `connection_limit=5`。

## Graceful Shutdown

SIGTERM 受信 → 再生中の音声を中断 → 全キュークリア → 全 VC 切断 → プロセス終了。切断時の読み上げは行わない。

## 必要な Discord Intents

- `Guilds` — ギルド情報取得
- `GuildVoiceStates` — VC 参加・退出・移動検知
- `GuildMessages` — テキストチャンネルのメッセージ受信
- `MessageContent` — メッセージ本文読み取り (Privileged Intent)

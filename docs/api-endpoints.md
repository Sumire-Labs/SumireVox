# API エンドポイント

## 共通仕様

成功: `{ "success": true, "data": { ... } }`
エラー: `{ "success": false, "error": { "code": "ERROR_CODE", "message": "説明" } }`

> エラーは未知パス・未対応メソッドを含め、すべて上記の JSON エンベロープで返す。未対応メソッドは Hono 4.12.8 の現行挙動により 405 ではなく 404 を返し、未知パスと同様に `NOT_FOUND` を返す。

### エラーコード

| コード | HTTP | 説明 |
|---|---|---|
| UNAUTHORIZED | 401 | 未認証 |
| FORBIDDEN | 403 | 権限不足 |
| NOT_FOUND | 404 | リソースなし |
| VALIDATION_ERROR | 400 | 入力値不正（競合系では 409 を返す場合あり） |
| BOOST_COOLDOWN | 400 | クールダウン中 |
| BOOST_LIMIT_REACHED | 400 | 枠上限 |
| GUILD_BOOST_LIMIT_REACHED | 400 | ギルドのブースト上限到達 |
| CHECKOUT_IN_PROGRESS | 409 | 決済処理進行中 |
| RATE_LIMITED | 429 | レート制限（Discord API 起因の場合は 503 を返す） |
| SESSION_EXPIRED | 401 | Discord 認可の期限切れ（クライアントに返る唯一のコード） |
| DICTIONARY_LIMIT_REACHED | 400 | 辞書上限 |
| DISCORD_TOKEN_EXPIRED | 401 | Discord アクセストークン失効（内部用。クライアントには返らない） |
| DISCORD_API_ERROR | 500/504 | Discord API 呼び出しエラー/タイムアウト |
| VOICEVOX_ERROR | 503 | VOICEVOX 接続エラー |
| SERVICE_UNAVAILABLE | 503 | サービス利用不可 |
| INTERNAL_ERROR | 500 | 内部エラー |

### ページネーション (オフセットベース)

`{ "success": true, "data": { "items": [...], "total": 45, "page": 1, "perPage": 20 } }`

## 認証

| メソッド | パス | 説明 |
|---|---|---|
| GET | /auth/login | Discord OAuth2 認可 URL にリダイレクト (scope: identify guilds, state でCSRF対策) |
| GET | /auth/callback | トークン交換・ユーザー情報取得・セッション作成・Cookie設定 |
| GET | /auth/me | セッションのユーザー情報返却 |
| POST | /auth/logout | セッション削除 |

## ユーザー向け (認証必要)

| メソッド | パス | 説明 |
|---|---|---|
| GET | /api/user/guilds | Bot が参加しているサーバー一覧 |
| GET | /api/user/boosts | ブースト枠一覧 |
| POST | /api/user/boosts/checkout | Stripe Checkout セッション作成 |
| POST | /api/user/boosts/assign | ギルドへのブースト割り当て数設定 (`body: { guildId, count }`) |
| PUT | /api/user/boosts/:boostId/assign | ブースト割り当て |
| PUT | /api/user/boosts/:boostId/unassign | ブースト解除 |
| POST | /api/user/billing-portal | Stripe Billing Portal セッション作成 |
| GET | /api/user/subscription | サブスク状況 |
| POST | /api/user/subscription/cancel | サブスク解約 |

## Stripe Webhook (Stripe 署名検証)

| メソッド | パス | 説明 |
|---|---|---|
| POST | /api/stripe/webhook | Stripe Webhook 受信 |

> 成功応答は `{ "received": true }`（共通エンベロープ外の機械連携用レスポンス）。イベントは `stripe_events` に outbox 化され、非同期処理される（`docs/boost-system.md` 参照）。

## その他（未認可）

| メソッド | パス | 説明 |
|---|---|---|
| GET | /health | ヘルスチェック（`{ "status": "ok" }`） |

## 認証済みユーザー向け（認証のみ・ManageGuild 不要）

| メソッド | パス | 説明 |
|---|---|---|
| GET | /api/voicevox/speakers | VOICEVOX スピーカー一覧（認証必要） |
| GET | /api/dictionary/global | グローバル辞書一覧（閲覧のみ） |

## サーバー管理者向け (認証 + ManageGuild)

| メソッド | パス | 説明 |
|---|---|---|
| GET | /api/guilds | 管理権限のあるサーバー一覧 |
| GET | /api/guilds/:guildId/settings | サーバー設定取得 |
| PUT | /api/guilds/:guildId/settings | サーバー設定変更 |
| GET | /api/guilds/:guildId/channels | チャンネル一覧 |
| GET | /api/guilds/:guildId/roles | ロール一覧 |
| GET | /api/guilds/:guildId/bots | Bot インスタンス一覧 |
| PUT | /api/guilds/:guildId/bots/:instanceId/settings | Bot インスタンス設定変更 |
| GET | /api/guilds/:guildId/bots/:instanceId/invite | Bot 招待 URL 取得 |
| GET | /api/guilds/:guildId/dictionary | サーバー辞書一覧 |
| POST | /api/guilds/:guildId/dictionary | サーバー辞書追加 |
| DELETE | /api/guilds/:guildId/dictionary/:word | サーバー辞書削除 |

### GET /api/guilds/:guildId/channels

成功時の `data` は、チャンネル項目を `{ id, name, parentId, type }` で返す。`type` は `text | announcement | voice | stage` のいずれかで、カテゴリは `{ id, name }` で返す。

| フィールド | 内容 |
|---|---|
| categories | カテゴリ一覧 |
| textChannels | `type: text` のチャンネル一覧（通常のテキスト） |
| voiceChannels | `type: voice` または `type: stage` のチャンネル一覧（Bot の接続候補） |
| readableChannels | `type: text | announcement | voice | stage` の全チャンネル一覧（Bot の読み上げ対象） |

ボイスチャンネルまたはステージチャンネルのテキストチャットを選択する場合は、そのチャンネル自身の `channelId` を指定する。Bot インスタンス設定の `textChannelId` はこのチャンネル ID を使用する。

## 認証済みユーザー向け Bot インスタンス情報

| メソッド | パス | 説明 |
|---|---|---|
| GET | /api/bot-instances | 全 Bot インスタンス一覧（認証済みユーザー向け） |

## Bot 管理者向け (認証 + BOT_ADMIN_USER_IDS)

| メソッド | パス | 説明 |
|---|---|---|
| GET | /api/admin/servers | 全サーバー一覧 |
| PUT | /api/admin/servers/:guildId/premium | 手動 PREMIUM 切替 |
| GET | /api/admin/servers/:guildId/settings | サーバー設定取得（管理者用） |
| PUT | /api/admin/servers/:guildId/settings | サーバー設定変更（管理者用） |
| GET | /api/admin/servers/:guildId/bots | Bot インスタンス一覧（管理者用） |
| PUT | /api/admin/servers/:guildId/bots/:instanceId/settings | Bot インスタンス設定変更（管理者用） |
| GET | /api/admin/servers/:guildId/channels | チャンネル一覧（管理者用） |
| GET | /api/admin/bot-instances | 全 Bot インスタンス一覧 |
| PUT | /api/admin/bot-instances/:instanceId/active | Bot インスタンスのアクティブ状態変更 |
| GET | /api/admin/dictionary/global | グローバル辞書一覧 |
| POST | /api/admin/dictionary/global | グローバル辞書追加 |
| PUT | /api/admin/dictionary/global/:word | グローバル辞書編集 |
| DELETE | /api/admin/dictionary/global/:word | グローバル辞書削除 |
| GET | /api/admin/announcements | お知らせ一覧 |
| GET | /api/admin/announcements/:id | お知らせ取得 |
| POST | /api/admin/announcements | お知らせ作成 |
| PUT | /api/admin/announcements/:id | お知らせ更新（公開状態の切替を含む） |
| DELETE | /api/admin/announcements/:id | お知らせ削除 |
| GET | /api/admin/dictionary/requests | 申請一覧 |
| PUT | /api/admin/dictionary/requests/:id/approve | 承認 |
| PUT | /api/admin/dictionary/requests/:id/reject | 却下 |

## ミドルウェア

- CORS (credentials: true, 許可オリジンは `CORS_ORIGIN` で設定)
- リクエストログ (pino)
- セッション読み込み (Cookie → Redis)
- 認証必須チェック
- ManageGuild 権限チェック (Discord API でギルド権限確認)
- Bot 管理者チェック (BOT_ADMIN_USER_IDS)

## 公開お知らせ

| メソッド | パス | 説明 |
|---|---|---|
| GET | /api/announcements | 公開済みお知らせ一覧（公開日時の新しい順） |
| GET | /api/announcements/:id | 公開済みお知らせ詳細 |

公開 API は下書き・非公開・公開開始前のお知らせを返さない。

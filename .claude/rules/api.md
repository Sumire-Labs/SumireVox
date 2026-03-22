---
paths:
  - "apps/api/**"
---

# API サーバー固有ルール

## フレームワーク

Hono を使用。

## レスポンス形式

- 成功: `{ "success": true, "data": { ... } }`
- エラー: `{ "success": false, "error": { "code": "ERROR_CODE", "message": "説明" } }`

## 認証

- Discord OAuth2 → セッション (Redis) → Cookie
- セッション TTL 7日
- CSRF 対策として state パラメータ使用

## ミドルウェアの順序

1. CORS (credentials: true)
2. リクエストログ (pino)
3. Stripe Webhook のみ raw body パース (署名検証のため)
4. セッション読み込み (Cookie → Redis)
5. 認証チェック (ルートごと)
6. 権限チェック (ManageGuild / Bot管理者)

## DB 更新後の Pub/Sub

設定変更・辞書更新時は DB 更新後に必ず Redis Pub/Sub でイベント発行すること。

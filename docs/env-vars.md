# 環境変数一覧

| 変数名 | 説明 | デフォルト |
|---|---|---|
| NODE_ENV | development / production | production |
| BOT_INSTANCE_ID | 起動する Bot インスタンス番号。`DISCORD_TOKEN_<N>` / `DISCORD_CLIENT_ID_<N>` の `N` に対応 | 1 |
| DISCORD_TOKEN_<N> | Discord Bot トークン。`N = BOT_INSTANCE_ID`。複数インスタンス運用時は `DISCORD_TOKEN_1`, `DISCORD_TOKEN_2` ... を設定 | Bot 起動時は対応する番号が必須 |
| DISCORD_CLIENT_ID_<N> | Discord Bot 用クライアントID。`N = BOT_INSTANCE_ID`。複数インスタンス運用時は `DISCORD_CLIENT_ID_1`, `DISCORD_CLIENT_ID_2` ... を設定 | Bot 起動時は対応する番号が必須 |
| DISCORD_CLIENT_ID | API サーバーの Discord OAuth2 用クライアントID（サフィックスなし） | API 起動時は必須 |
| DISCORD_CLIENT_SECRET | Discord OAuth2 シークレット | (必須) |
| DATABASE_URL | PostgreSQL 接続URL (?connection_limit=N 含む) | (必須) |
| REDIS_URL | Redis 接続URL | (必須) |
| VOICEVOX_URLS | VOICEVOX URL (カンマ区切り複数可) | http://voicevox:50021 |
| DEFAULT_SPEAKER_ID | デフォルト話者ID | 1 |
| MAX_CONCURRENT_SYNTHESIS_PER_GUILD | ギルドあたり同時合成上限 | 3 |
| MAX_CONCURRENT_SYNTHESIS_GLOBAL | 全シャード合計同時合成上限 | 10 |
| HEALTH_CHECK_INTERVAL_SECONDS | VOICEVOX ヘルスチェック間隔 | 30 |
| VOICE_DISCONNECT_TIMEOUT_SECONDS | VC 自動退出秒数 | 300 |
| SETTINGS_CACHE_TTL_SECONDS | 設定キャッシュ TTL | 300 |
| BOT_ADMIN_USER_IDS | Bot 管理者 (カンマ区切り) | (必須) |
| GLOBAL_DICT_NOTIFICATION_CHANNEL_ID | 辞書申請通知チャンネルID | (必須) |
| DEPLOY_GUILD_ID | コマンド登録先ギルドID (未設定→グローバル) | (なし) |
| API_PORT | API ポート | 3000 |
| SESSION_SECRET | セッション署名シークレット | (必須) |
| CORS_ORIGIN | CORS 許可オリジン (カンマ区切り) | (必須) |
| LOG_LEVEL | ログレベル | info |
| STRIPE_SECRET_KEY | Stripe シークレットキー | （空文字 = Stripe 無効） |
| STRIPE_WEBHOOK_SECRET | Stripe Webhook 署名シークレット | （空文字 = Stripe 無効） |
| STRIPE_PRICE_ID | ブースト Price ID | （空文字 = Stripe 無効） |
| BOOST_COOLDOWN_DAYS | クールダウン日数 | 7 |
| STRIPE_RECONCILE_INTERVAL_MS | Stripe サブスクリプション定期整合処理の実行間隔 (ms) | 3600000 (1時間) |
| API_DOMAIN | API サーバーの公開ドメイン | http://localhost:3000 |
| WEB_DOMAIN | メインサイトドメイン | http://localhost:5173 |
| ADMIN_DOMAIN | 管理者ダッシュボードドメイン | http://localhost:5174 |

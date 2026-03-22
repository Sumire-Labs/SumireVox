# 環境変数一覧

| 変数名 | 説明 | デフォルト |
|---|---|---|
| NODE_ENV | development / production | production |
| DISCORD_TOKEN | Discord Bot トークン | (必須) |
| DISCORD_CLIENT_ID | Discord クライアントID | (必須) |
| DISCORD_CLIENT_SECRET | Discord OAuth2 シークレット | (必須) |
| DATABASE_URL | PostgreSQL 接続URL (?connection_limit=N 含む) | (必須) |
| REDIS_URL | Redis 接続URL | (必須) |
| VOICEVOX_URLS | VOICEVOX URL (カンマ区切り複数可) | http://voicevox:50021 |
| DEFAULT_SPEAKER_ID | デフォルト話者ID | (必須) |
| MAX_CONCURRENT_SYNTHESIS_PER_GUILD | ギルドあたり同時合成上限 | 3 |
| MAX_CONCURRENT_SYNTHESIS_GLOBAL | 全シャード合計同時合成上限 | 10 |
| HEALTH_CHECK_INTERVAL_SECONDS | VOICEVOX ヘルスチェック間隔 | (必須) |
| VOICE_DISCONNECT_TIMEOUT_SECONDS | VC 自動退出秒数 | (必須) |
| SETTINGS_CACHE_TTL_SECONDS | 設定キャッシュ TTL | (必須) |
| BOT_ADMIN_USER_IDS | Bot 管理者 (カンマ区切り) | (必須) |
| GLOBAL_DICT_NOTIFICATION_CHANNEL_ID | 辞書申請通知チャンネルID | (必須) |
| DEPLOY_GUILD_ID | コマンド登録先ギルドID (未設定→グローバル) | (なし) |
| API_PORT | API ポート | 3000 |
| SESSION_SECRET | セッション署名シークレット | (必須) |
| CORS_ORIGIN | CORS 許可オリジン (カンマ区切り) | (必須) |
| LOG_LEVEL | ログレベル | info |
| STRIPE_SECRET_KEY | Stripe シークレットキー | (必須) |
| STRIPE_WEBHOOK_SECRET | Stripe Webhook 署名シークレット | (必須) |
| STRIPE_PRICE_ID | ブースト Price ID | (必須) |
| BOOST_COOLDOWN_DAYS | クールダウン日数 | 7 |
| WEB_DOMAIN | メインサイトドメイン | (必須) |
| ADMIN_DOMAIN | 管理者ダッシュボードドメイン | (必須) |

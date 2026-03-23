#!/bin/bash
# SumireVox 開発環境セットアップスクリプト

if [ -f .env ]; then
  echo ".env already exists. Skipping."
  exit 0
fi

cp .env.example .env

echo ""
echo "==================================="
echo " SumireVox - 環境変数セットアップ"
echo "==================================="
echo ""
echo ".env ファイルを作成しました。"
echo "以下の値を .env に設定してください:"
echo ""
echo "【必須】"
echo "  DISCORD_TOKEN        — Discord Developer Portal > Bot > Token"
echo "  DISCORD_CLIENT_ID    — Discord Developer Portal > OAuth2 > Client ID"
echo "  DISCORD_CLIENT_SECRET — Discord Developer Portal > OAuth2 > Client Secret"
echo ""
echo "【開発時のデフォルト値（変更不要）】"
echo "  DATABASE_URL=postgresql://sumirevox:sumirevox_dev@localhost:5432/sumirevox"
echo "  REDIS_URL=redis://localhost:6379"
echo "  VOICEVOX_URLS=http://localhost:50021"
echo ""
echo "【Stripe（ブースト機能を使う場合）】"
echo "  STRIPE_SECRET_KEY"
echo "  STRIPE_WEBHOOK_SECRET"
echo "  STRIPE_PRICE_ID"
echo ""
echo "==================================="

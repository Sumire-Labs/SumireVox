-- 自動接続設定をBotごとのJSONからサーバー共通設定へ移す。
ALTER TABLE "guild_settings"
  ADD COLUMN "auto_join_settings" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "bot_instance_priority" JSONB NOT NULL DEFAULT '[]';

-- 既存ユーザーの主Bot（1号機）の設定をそのまま引き継ぐ。
UPDATE "guild_settings"
SET "auto_join_settings" = CASE
  WHEN jsonb_typeof("bot_instance_settings") = 'object'
    AND jsonb_typeof("bot_instance_settings" -> '1') = 'object'
    THEN "bot_instance_settings" -> '1'
  ELSE '{}'
END
WHERE "auto_join_settings" = '{}';

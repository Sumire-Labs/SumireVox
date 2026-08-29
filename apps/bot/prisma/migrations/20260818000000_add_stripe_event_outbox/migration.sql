-- Stripe イベントの outbox 化（Webhook の耐久性確保）のためのカラム追加
-- 既存行は「処理済み」として扱うため、status の初期デフォルトは PROCESSED にする。

-- payload: 署名検証済みイベントの生 JSON（replay 用）
ALTER TABLE "stripe_events" ADD COLUMN "payload" JSONB NOT NULL DEFAULT '{}';
-- status: 'PENDING' | 'PROCESSED'
ALTER TABLE "stripe_events" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PROCESSED';
-- attempts: 処理試行回数
ALTER TABLE "stripe_events" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
-- last_error: 直前の処理失敗内容
ALTER TABLE "stripe_events" ADD COLUMN "last_error" TEXT;
-- created_at: 受信（enqueue）時刻
ALTER TABLE "stripe_events" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- processed_at は「処理成功時刻」に意味を変えるため NULL 許容にし、デフォルトを外す
ALTER TABLE "stripe_events" ALTER COLUMN "processed_at" DROP NOT NULL;
ALTER TABLE "stripe_events" ALTER COLUMN "processed_at" DROP DEFAULT;

-- 既存行（すべて処理済み）の created_at を processed_at で埋め戻す
UPDATE "stripe_events" SET "created_at" = "processed_at";

-- 以後の新規行は PENDING をデフォルトにする（outbox は常に明示 status を書くが、安全策として）
ALTER TABLE "stripe_events" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- payload は outbox が常に明示値を書くため、カラムに DEFAULT を残さない
-- （Prisma モデル上 payload に @default は無いため、DB にも DEFAULT を残すと drift になる）
ALTER TABLE "stripe_events" ALTER COLUMN "payload" DROP DEFAULT;
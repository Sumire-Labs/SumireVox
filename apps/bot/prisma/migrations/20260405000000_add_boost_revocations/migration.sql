-- CreateTable
CREATE TABLE "boost_revocations" (
    "id" TEXT NOT NULL,
    "boost_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "guild_id" TEXT,
    "assigned_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,

    CONSTRAINT "boost_revocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guild_settings" (
    "guild_id" TEXT NOT NULL,
    "max_read_length" INTEGER NOT NULL DEFAULT 50,
    "read_username" BOOLEAN NOT NULL DEFAULT false,
    "add_san_suffix" BOOLEAN NOT NULL DEFAULT false,
    "romaji_reading" BOOLEAN NOT NULL DEFAULT false,
    "join_leave_notification" BOOLEAN NOT NULL DEFAULT false,
    "greeting_on_join" BOOLEAN NOT NULL DEFAULT false,
    "custom_emoji_handling" TEXT NOT NULL DEFAULT 'read_name',
    "read_target_type" TEXT NOT NULL DEFAULT 'text_only',
    "auto_join" BOOLEAN NOT NULL DEFAULT false,
    "default_text_channel_id" TEXT,
    "default_speaker_id" INTEGER,
    "admin_role_id" TEXT,
    "dictionary_permission" TEXT NOT NULL DEFAULT 'admin_only',
    "manual_premium" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_settings_pkey" PRIMARY KEY ("guild_id")
);

-- CreateTable
CREATE TABLE "user_voice_settings" (
    "user_id" TEXT NOT NULL,
    "speaker_id" INTEGER,
    "speed_scale" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "pitch_scale" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_voice_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "global_dictionary" (
    "word" TEXT NOT NULL,
    "reading" TEXT NOT NULL,
    "registered_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_dictionary_pkey" PRIMARY KEY ("word")
);

-- CreateTable
CREATE TABLE "global_dictionary_requests" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "reading" TEXT NOT NULL,
    "reason" TEXT,
    "requested_by" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_dictionary_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "server_dictionary" (
    "guild_id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "reading" TEXT NOT NULL,
    "registered_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "user_id" TEXT NOT NULL,
    "stripe_customer_id" TEXT NOT NULL,
    "stripe_subscription_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INCOMPLETE',
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "boost_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("user_id","stripe_subscription_id")
);

-- CreateTable
CREATE TABLE "boosts" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "guild_id" TEXT,
    "assigned_at" TIMESTAMP(3),
    "unassigned_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boosts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "server_dictionary_guild_id_word_key" ON "server_dictionary"("guild_id", "word");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripe_subscription_id_key" ON "subscriptions"("stripe_subscription_id");

-- AddForeignKey
ALTER TABLE "boosts" ADD CONSTRAINT "boosts_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("stripe_subscription_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boosts" ADD CONSTRAINT "boosts_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guild_settings"("guild_id") ON DELETE SET NULL ON UPDATE CASCADE;

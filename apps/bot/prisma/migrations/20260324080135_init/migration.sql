-- AlterTable
ALTER TABLE "guild_settings" ADD COLUMN     "bot_instance_settings" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "bot_instances" (
    "instance_id" INTEGER NOT NULL,
    "bot_user_id" VARCHAR(20) NOT NULL,
    "client_id" VARCHAR(20) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_instances_pkey" PRIMARY KEY ("instance_id")
);

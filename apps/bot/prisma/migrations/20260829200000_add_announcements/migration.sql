-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "body" TEXT NOT NULL,
    "type" VARCHAR(20) NOT NULL DEFAULT 'info',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "announcements_published_published_at_idx" ON "announcements"("published", "published_at");

-- CreateIndex
CREATE INDEX "announcements_created_at_idx" ON "announcements"("created_at");

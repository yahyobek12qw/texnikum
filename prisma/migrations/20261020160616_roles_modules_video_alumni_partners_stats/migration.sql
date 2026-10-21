-- CreateEnum
CREATE TYPE "VideoProvider" AS ENUM ('YOUTUBE', 'VIMEO');

-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'ADMISSION';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'PUBLISHER';
ALTER TYPE "Role" ADD VALUE 'EDITOR';

-- AlterTable
ALTER TABLE "pages" ADD COLUMN     "module" TEXT;

-- CreateTable
CREATE TABLE "gallery_videos" (
    "id" TEXT NOT NULL,
    "provider" "VideoProvider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "thumbMediaId" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gallery_videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gallery_video_translations" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "gallery_video_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alumni" (
    "id" TEXT NOT NULL,
    "graduationYear" INTEGER,
    "photoMediaId" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alumni_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alumni_translations" (
    "id" TEXT NOT NULL,
    "alumnusId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "fullName" TEXT NOT NULL,
    "program" TEXT NOT NULL DEFAULT '',
    "workplace" TEXT NOT NULL DEFAULT '',
    "story" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "alumni_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners" (
    "id" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "logoMediaId" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_translations" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "partner_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_views" (
    "day" DATE NOT NULL,
    "path" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "page_views_pkey" PRIMARY KEY ("day","path")
);

-- CreateIndex
CREATE INDEX "gallery_videos_status_sortOrder_idx" ON "gallery_videos"("status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "gallery_video_translations_videoId_locale_key" ON "gallery_video_translations"("videoId", "locale");

-- CreateIndex
CREATE INDEX "alumni_status_graduationYear_idx" ON "alumni"("status", "graduationYear");

-- CreateIndex
CREATE UNIQUE INDEX "alumni_translations_alumnusId_locale_key" ON "alumni_translations"("alumnusId", "locale");

-- CreateIndex
CREATE INDEX "partners_status_sortOrder_idx" ON "partners"("status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "partner_translations_partnerId_locale_key" ON "partner_translations"("partnerId", "locale");

-- CreateIndex
CREATE INDEX "page_views_day_idx" ON "page_views"("day");

-- AddForeignKey
ALTER TABLE "gallery_videos" ADD CONSTRAINT "gallery_videos_thumbMediaId_fkey" FOREIGN KEY ("thumbMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_video_translations" ADD CONSTRAINT "gallery_video_translations_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "gallery_videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alumni" ADD CONSTRAINT "alumni_photoMediaId_fkey" FOREIGN KEY ("photoMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alumni_translations" ADD CONSTRAINT "alumni_translations_alumnusId_fkey" FOREIGN KEY ("alumnusId") REFERENCES "alumni"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_logoMediaId_fkey" FOREIGN KEY ("logoMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_translations" ADD CONSTRAINT "partner_translations_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

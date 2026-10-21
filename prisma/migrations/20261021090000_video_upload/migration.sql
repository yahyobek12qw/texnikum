-- AlterEnum
ALTER TYPE "MediaKind" ADD VALUE 'VIDEO';

-- AlterEnum
ALTER TYPE "VideoProvider" ADD VALUE 'UPLOAD';

-- AlterTable
ALTER TABLE "gallery_videos" ADD COLUMN "fileMediaId" TEXT;

-- AddForeignKey
ALTER TABLE "gallery_videos" ADD CONSTRAINT "gallery_videos_fileMediaId_fkey" FOREIGN KEY ("fileMediaId") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

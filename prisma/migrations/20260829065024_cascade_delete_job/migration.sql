-- DropForeignKey
ALTER TABLE "Job" DROP CONSTRAINT "Job_videoId_fkey";

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

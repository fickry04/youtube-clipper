/*
  Warnings:

  - You are about to drop the column `bullmqId` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `result` on the `Job` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Job" DROP COLUMN "bullmqId",
DROP COLUMN "result";

-- AlterTable
ALTER TABLE "SocialAccount" ADD COLUMN     "encryptedCredential" TEXT;

/*
  Warnings:

  - You are about to drop the `FaceDetection` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "FaceDetection" DROP CONSTRAINT "FaceDetection_clipId_fkey";

-- DropTable
DROP TABLE "FaceDetection";

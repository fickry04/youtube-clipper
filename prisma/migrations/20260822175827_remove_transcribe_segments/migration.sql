/*
  Warnings:

  - You are about to drop the `TranscriptSegment` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "TranscriptSegment" DROP CONSTRAINT "TranscriptSegment_transcriptId_fkey";

-- AlterTable
ALTER TABLE "Transcript" ADD COLUMN     "segments" JSONB NOT NULL DEFAULT '[]';

-- DropTable
DROP TABLE "TranscriptSegment";

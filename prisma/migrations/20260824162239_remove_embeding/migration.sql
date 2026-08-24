/*
  Warnings:

  - You are about to drop the `Embedding` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Embedding" DROP CONSTRAINT "Embedding_clipId_fkey";

-- DropTable
DROP TABLE "Embedding";

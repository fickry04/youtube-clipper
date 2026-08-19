-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "youtubeUrl" TEXT NOT NULL,
    "youtubeId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "duration" INTEGER,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoAsset" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" BIGINT,
    "duration" DOUBLE PRECISION,
    "width" INTEGER,
    "height" INTEGER,
    "videoId" TEXT,
    "clipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transcript" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transcript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranscriptSegment" (
    "id" TEXT NOT NULL,
    "transcriptId" TEXT NOT NULL,
    "offset" DOUBLE PRECISION NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "text" TEXT NOT NULL,
    "lang" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "TranscriptSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViralAnalysis" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "overallSummary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ViralAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clip" (
    "id" TEXT NOT NULL,
    "viralAnalysisId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "viralScore" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "startSeconds" DOUBLE PRECISION NOT NULL,
    "endSeconds" DOUBLE PRECISION NOT NULL,
    "durationSeconds" DOUBLE PRECISION NOT NULL,
    "title" TEXT NOT NULL,
    "hook" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "whyViral" TEXT NOT NULL,
    "category" TEXT[],
    "strengths" TEXT[],
    "weaknesses" TEXT[],
    "processingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "processingError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Clip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subtitle" (
    "id" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'srt',
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subtitle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaceDetection" (
    "id" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "timestamp" DOUBLE PRECISION NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FaceDetection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Embedding" (
    "id" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "vector" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Embedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "payload" JSONB,
    "result" JSONB,
    "error" TEXT,
    "bullmqId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Project_userId_idx" ON "Project"("userId");

-- CreateIndex
CREATE INDEX "Video_projectId_idx" ON "Video"("projectId");

-- CreateIndex
CREATE INDEX "Video_youtubeId_idx" ON "Video"("youtubeId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoAsset_clipId_key" ON "VideoAsset"("clipId");

-- CreateIndex
CREATE INDEX "VideoAsset_videoId_idx" ON "VideoAsset"("videoId");

-- CreateIndex
CREATE UNIQUE INDEX "Transcript_videoId_key" ON "Transcript"("videoId");

-- CreateIndex
CREATE INDEX "TranscriptSegment_transcriptId_idx" ON "TranscriptSegment"("transcriptId");

-- CreateIndex
CREATE INDEX "TranscriptSegment_transcriptId_offset_idx" ON "TranscriptSegment"("transcriptId", "offset");

-- CreateIndex
CREATE UNIQUE INDEX "ViralAnalysis_videoId_key" ON "ViralAnalysis"("videoId");

-- CreateIndex
CREATE INDEX "Clip_viralAnalysisId_idx" ON "Clip"("viralAnalysisId");

-- CreateIndex
CREATE INDEX "Subtitle_clipId_idx" ON "Subtitle"("clipId");

-- CreateIndex
CREATE UNIQUE INDEX "Subtitle_clipId_format_key" ON "Subtitle"("clipId", "format");

-- CreateIndex
CREATE INDEX "FaceDetection_clipId_idx" ON "FaceDetection"("clipId");

-- CreateIndex
CREATE UNIQUE INDEX "Embedding_clipId_key" ON "Embedding"("clipId");

-- CreateIndex
CREATE INDEX "Job_userId_idx" ON "Job"("userId");

-- CreateIndex
CREATE INDEX "Job_videoId_idx" ON "Job"("videoId");

-- CreateIndex
CREATE INDEX "Job_status_idx" ON "Job"("status");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoAsset" ADD CONSTRAINT "VideoAsset_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoAsset" ADD CONSTRAINT "VideoAsset_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "Clip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transcript" ADD CONSTRAINT "Transcript_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptSegment" ADD CONSTRAINT "TranscriptSegment_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "Transcript"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViralAnalysis" ADD CONSTRAINT "ViralAnalysis_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clip" ADD CONSTRAINT "Clip_viralAnalysisId_fkey" FOREIGN KEY ("viralAnalysisId") REFERENCES "ViralAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subtitle" ADD CONSTRAINT "Subtitle_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "Clip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaceDetection" ADD CONSTRAINT "FaceDetection_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "Clip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Embedding" ADD CONSTRAINT "Embedding_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "Clip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE SET NULL ON UPDATE CASCADE;

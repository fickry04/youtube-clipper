/**
 * workers/processors/transcript.processor.ts
 *
 * Fetches the YouTube transcript via youtube-transcript-plus,
 * saves segments to DB, then enqueues a VIRAL_ANALYSIS job.
 */

import { Job } from 'bullmq';
import { fetchTranscript } from 'youtube-transcript-plus';
import prisma from '../../lib/prisma';
import type { TranscriptPayload } from '../../lib/queue/jobs';

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

export async function processTranscript(job: Job<TranscriptPayload>): Promise<void> {
  const { jobId, videoId, userId, youtubeId, youtubeUrl, languageCode } = job.data;

  // Mark as PROCESSING
  await prisma.job.update({
    where: { id: jobId },
    data: { status: 'PROCESSING', startedAt: new Date(), attempts: { increment: 1 } },
  });

  await job.updateProgress(10);

  try {
    // Fetch transcript from YouTube
    const rawSegments = await fetchTranscript(youtubeId, {
      ...(languageCode && { lang: languageCode }),
    });

    if (!rawSegments || rawSegments.length === 0) {
      throw new Error(`No transcript found for video "${youtubeId}".`);
    }

    const segments = rawSegments.map((s) => ({
      ...s,
      text: decodeHtmlEntities(s.text),
    }));

    await job.updateProgress(50);

    // Persist to DB inside a transaction
    let transcriptId: string;
    await prisma.$transaction(async (tx) => {
      const transcript = await tx.transcript.upsert({
        where: { videoId },
        update: {
          languageCode: languageCode ?? 'default',
          updatedAt: new Date(),
        },
        create: {
          videoId,
          languageCode: languageCode ?? 'default',
        },
      });
      transcriptId = transcript.id;

      // Replace existing segments
      await tx.transcriptSegment.deleteMany({
        where: { transcriptId: transcript.id },
      });

      await tx.transcriptSegment.createMany({
        data: segments.map((s, idx) => ({
          transcriptId: transcript.id,
          offset: s.offset,
          duration: s.duration,
          text: s.text,
          lang: s.lang ?? null,
          order: idx,
        })),
      });
    });

    await job.updateProgress(85);

    // Mark job complete. Pipeline stops here — the user triggers analysis manually.
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'COMPLETED', progress: 100, completedAt: new Date() },
    });

    await job.updateProgress(100);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'FAILED', error: message, completedAt: new Date() },
    });
    throw err;
  }
}

/**
 * workers/processors/subtitle.processor.ts
 *
 * 100% Remotion Subtitle Engine (No FFmpeg ASS burning):
 *   1. Check that 9:16 vertical video exists
 *   2. Run local nodejs-whisper (whisper.cpp) on the clip audio for exact word-level timestamps
 *   3. Render high-definition 9:16 vertical video with Remotion animated captions
 *   4. Save the rendered Remotion vertical video to storage (`clip_vertical_subtitled.mp4`)
 *   5. Persist SRT and Remotion cues/config to database & storage
 */

import { Job } from 'bullmq';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import prisma from '../../lib/prisma';
import { getStorage, StorageKeys, LocalStorageService } from '../../lib/storage';
import { transcribeClip } from '../../lib/whisper';
import { cuesToSrt, groupWordsIntoCues } from '../../lib/transcript/word-timestamps';
import { renderRemotionSubtitles } from '../../lib/remotion/render';
import { parseTranscriptSegments } from '../../lib/utils';
import type { ExportVideoPayload } from '../../lib/queue/jobs';
import type { CaptionCue } from '../../remotion/types';
import { setJobProgress } from '@/workers';

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export async function processExportVideo(job: Job<ExportVideoPayload>): Promise<void> {
    const { jobId, userId, clipId, styleConfig } = job.data;

    await prisma.job.update({
        where: { id: jobId },
        data: { status: 'PROCESSING', progress: 10, startedAt: new Date(), attempts: { increment: 1 } },
    });

    await setJobProgress(jobId, job, 10);

    try {
        const storage = getStorage();

        // 1. Verify 9:16 vertical video exists
        const verticalKey = StorageKeys.clipVertical(userId, clipId);
        const hasVertical = await storage.exists(verticalKey);
        if (!hasVertical) {
            throw new Error('Video vertikal 9:16 belum dibuat. Silakan lakukan Auto-Crop 9:16 (Face AI) terlebih dahulu.');
        }

        // 2. Load clip and transcript
        const clip = await prisma.clip.findUnique({
            where: { id: clipId },
            include: {
                viralAnalysis: {
                    include: {
                        video: {
                            include: {
                                transcript: true,
                            },
                        },
                    },
                },
                asset: true,
            },
        });

        if (!clip) throw new Error(`Clip ${clipId} tidak ditemukan.`);

        const transcript = clip.viralAnalysis.video.transcript;
        const segments = parseTranscriptSegments(transcript?.segments);

        let verticalPath: string;
        if (storage instanceof LocalStorageService) {
            verticalPath = storage.getAbsolutePath(verticalKey);
        } else {
            verticalPath = await storage.get(verticalKey);
        }

        await setJobProgress(jobId, job, 25);

        // 3. Resolve cues: Use existing calibrated cues from job payload / database if available
        const wordsPerPage = styleConfig?.wordsPerPage || 3;
        let cues: CaptionCue[] = [];

        // Check A: Cues provided directly in job payload (from the studio modal preview)
        if (job.data.cues && Array.isArray(job.data.cues) && job.data.cues.length > 0) {
            const allWords = job.data.cues.flatMap((c) => c.words || []);
            if (allWords.length > 0) {
                cues = groupWordsIntoCues(allWords, wordsPerPage, clip.durationSeconds);
            } else {
                cues = job.data.cues;
            }
            console.log(`[Export Worker] Using ${cues.length} preview cues provided directly in job payload for clip ${clipId}.`);
        }

        // Check B: Cues saved previously in database
        if (cues.length === 0) {
            const jsonSub = await prisma.subtitle.findUnique({
                where: { clipId_format: { clipId, format: 'json' } },
            });
            if (jsonSub?.content) {
                try {
                    const parsed = JSON.parse(jsonSub.content);
                    if (Array.isArray(parsed.cues) && parsed.cues.length > 0) {
                        const allWords = parsed.cues.flatMap((c: CaptionCue) => c.words || []);
                        if (allWords.length > 0) {
                            cues = groupWordsIntoCues(allWords, wordsPerPage, clip.durationSeconds);
                        } else {
                            cues = parsed.cues;
                        }
                        console.log(`[Subtitle Worker] Using ${cues.length} cached cues from database for clip ${clipId}.`);
                    }
                } catch { }
            }
        }

        // Check C: If still no cues, run transcription as fallback
        if (cues.length === 0) {
            const selectedEngine = job.data.sttEngine || styleConfig?.sttEngine || 'whisper';
            console.log(`[Subtitle Worker] No cached cues found. Running ${selectedEngine.toUpperCase()} transcription for clip ${clipId}...`);
            cues = await transcribeClip({
                mediaPath: verticalPath,
                clipDurationSeconds: clip.durationSeconds,
                wordsPerPage,
                contextHint: `${clip.title} — ${clip.summary}`,
                fallbackSegments: segments,
                clipStartSeconds: clip.startSeconds,
                engine: selectedEngine,
            });
        }

        if (cues.length === 0) {
            throw new Error('Gagal menghasilkan subtitle dari audio klip.');
        }

        const srtContent = cuesToSrt(cues);

        await setJobProgress(jobId, job, 45);

        // 4. Render 9:16 Vertical Video with Remotion Headless Renderer
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `remotion-sub-${clipId}-`));
        const renderedOutputTmp = path.join(tmpDir, 'remotion_vertical_subtitled.mp4');

        try {
            console.log(`[Subtitle Worker] Rendering Remotion composition for clip ${clipId}...`);
            await renderRemotionSubtitles({
                videoPath: verticalPath,
                outputPath: renderedOutputTmp,
                durationSeconds: clip.durationSeconds,
                cues,
                styleConfig,
                onProgress: async (p) => {
                    const mappedProgress = Math.min(92, 45 + Math.round(p * 47));
                    await setJobProgress(jobId, job, mappedProgress);
                },
            });

            await setJobProgress(jobId, job, 93);

            // 5. Save rendered Remotion subtitled video to storage
            const subtitledVerticalKey = StorageKeys.clipVerticalSubtitled(userId, clipId);
            await storage.save(subtitledVerticalKey, renderedOutputTmp);

            // 6. Save SRT and JSON cues/config to database & storage
            const srtKey = StorageKeys.clipSubtitle(userId, clipId);
            await storage.saveBuffer(srtKey, srtContent, 'utf-8');

            await prisma.subtitle.upsert({
                where: { clipId_format: { clipId, format: 'srt' } },
                update: { content: srtContent, updatedAt: new Date() },
                create: { clipId, format: 'srt', content: srtContent },
            });

            await prisma.subtitle.upsert({
                where: { clipId_format: { clipId, format: 'json' } },
                update: {
                    content: JSON.stringify({ cues, styleConfig, updatedAt: new Date().toISOString() }),
                    updatedAt: new Date(),
                },
                create: {
                    clipId,
                    format: 'json',
                    content: JSON.stringify({ cues, styleConfig, updatedAt: new Date().toISOString() }),
                },
            });

            await setJobProgress(jobId, job, 98);
        } finally {
            await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => { });
        }

        // 7. Mark job complete
        await prisma.job.update({
            where: { id: jobId },
            data: { status: 'COMPLETED', progress: 100, completedAt: new Date() },
        });

        await job.updateProgress(100);
        console.log(`[Subtitle Worker] ✓ Remotion Subtitles completed successfully for clip ${clipId}.`);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[Subtitle Worker] ✗ Subtitle processing failed:`, err);
        await prisma.job.update({
            where: { id: jobId },
            data: { status: 'FAILED', error: message, completedAt: new Date() },
        });
        throw err;
    }
}

/**
 * workers/processors/subtitle.processor.ts
 *
 * For a given clip:
 *   1. Load the transcript segments that overlap the clip's time range
 *   2. Build an SRT string with timestamps relative to the clip start
 *   3. Save the SRT to the Subtitle table and to storage
 *   4. Burn the subtitle into the clip video using FFmpeg (re-encode)
 *   5. Save the burned clip as a new VideoAsset (or update existing)
 *
 * The original clip (stream-copied) is preserved.
 * A new file `clip_burned.mp4` (or replaced if already exists) is produced.
 */

import { Job } from 'bullmq';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import prisma from '../../lib/prisma';
import { getStorage, StorageKeys, LocalStorageService } from '../../lib/storage';
import { burnSubtitle } from '../../lib/ffmpeg';
import type { GenerateSubtitlePayload } from '../../lib/queue/jobs';

// ---------------------------------------------------------------------------
// SRT helpers
// ---------------------------------------------------------------------------

/**
 * Format seconds to SRT timestamp: HH:MM:SS,mmm
 */
function toSrtTime(seconds: number): string {
    const totalMs = Math.round(seconds * 1000);
    const ms = totalMs % 1000;
    const totalSec = Math.floor(totalMs / 1000);
    const s = totalSec % 60;
    const totalMin = Math.floor(totalSec / 60);
    const m = totalMin % 60;
    const h = Math.floor(totalMin / 60);
    return (
        `${String(h).padStart(2, '0')}:` +
        `${String(m).padStart(2, '0')}:` +
        `${String(s).padStart(2, '0')},` +
        `${String(ms).padStart(3, '0')}`
    );
}

interface SrtCue {
    index: number;
    startSec: number;
    endSec: number;
    text: string;
}

/**
 * Build an SRT string from a list of cues.
 */
function buildSrt(cues: SrtCue[]): string {
    return cues
        .map((c) =>
            `${c.index}\n${toSrtTime(c.startSec)} --> ${toSrtTime(c.endSec)}\n${c.text}`
        )
        .join('\n\n');
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export async function processSubtitle(job: Job<GenerateSubtitlePayload>): Promise<void> {
    const { jobId, videoId, userId, clipId } = job.data;

    await prisma.job.update({
        where: { id: jobId },
        data: { status: 'PROCESSING', startedAt: new Date(), attempts: { increment: 1 } },
    });

    await job.updateProgress(5);

    try {
        // Load clip and its viralAnalysis (to reach videoId → transcript)
        const clip = await prisma.clip.findUnique({
            where: { id: clipId },
            include: {
                viralAnalysis: {
                    include: {
                        video: {
                            include: {
                                transcript: true
                            },
                        },
                    },
                },
                asset: true
            },
        });

        if (!clip) throw new Error(`Clip ${clipId} not found.`);

        const transcript = clip.viralAnalysis.video.transcript;
        const segments = (transcript?.segments as unknown as Array<{ offset: number; duration: number; text: string; lang?: string }>) ?? [];
        if (!transcript || !Array.isArray(segments) || segments.length === 0) {
            throw new Error('No transcript segments available for subtitle generation.');
        }

        const clipStart = clip.startSeconds;
        const clipEnd = clip.endSeconds;

        // Filter segments that overlap the clip window
        const overlapping = segments.filter((s) => {
            const segStart = s.offset;
            const segEnd = s.offset + s.duration;
            return segEnd > clipStart && segStart < clipEnd;
        });

        if (overlapping.length === 0) {
            throw new Error('No transcript segments overlap the clip time range.');
        }

        await job.updateProgress(20);

        // Build SRT cues (timestamps relative to clip start)
        const cues: SrtCue[] = overlapping.map((s, idx) => {
            const cueStart = Math.max(0, s.offset - clipStart);
            const cueEnd = Math.min(clip.durationSeconds, s.offset + s.duration - clipStart);
            return {
                index: idx + 1,
                startSec: cueStart,
                endSec: Math.max(cueStart + 0.1, cueEnd), // ensure non-zero duration
                text: s.text,
            };
        });

        const srtContent = buildSrt(cues);

        await job.updateProgress(35);

        // Persist SRT to the Subtitle table
        await prisma.subtitle.upsert({
            where: { clipId_format: { clipId, format: 'srt' } },
            update: { content: srtContent, updatedAt: new Date() },
            create: { clipId, format: 'srt', content: srtContent },
        });

        // Save SRT file to storage
        const storage = getStorage();
        const srtKey = StorageKeys.clipSubtitle(userId, clipId);
        await storage.saveBuffer(srtKey, srtContent, 'utf-8');

        await job.updateProgress(50);

        // Get paths for FFmpeg burn
        const clipKey = StorageKeys.clipVideo(userId, clipId);
        let clipVideoPath: string;
        if (storage instanceof LocalStorageService) {
            clipVideoPath = storage.getAbsolutePath(clipKey);
        } else {
            clipVideoPath = await storage.get(clipKey);
        }

        let srtPath: string;
        if (storage instanceof LocalStorageService) {
            srtPath = storage.getAbsolutePath(srtKey);
        } else {
            srtPath = await storage.get(srtKey);
        }

        // Determine output path for burned clip
        // We write to a temp file first, then move it into storage
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `vc-sub-${clipId}-`));
        const burnedTmp = path.join(tmpDir, 'burned.mp4');

        try {
            await burnSubtitle({
                videoPath: clipVideoPath,
                srtPath,
                outputPath: burnedTmp,
                fontSize: 22,
            });

            await job.updateProgress(85);

            // For local storage, the burned file lives alongside the original
            // We store it as a new key (clip_burned.mp4 equivalent)
            // Reuse the same clip key — overwrite the original with the burned version
            // so that the clip player always shows subtitles.
            // NOTE: If you want to preserve the original, use a separate key.
            if (storage instanceof LocalStorageService) {
                const burnedKey = `users/${userId}/clips/${clipId}/clip_burned.mp4`;
                await storage.save(burnedKey, burnedTmp);

                // Update VideoAsset to point to the burned version
                if (clip.asset) {
                    await prisma.videoAsset.update({
                        where: { id: clip.asset.id },
                        data: { storagePath: burnedKey },
                    });
                }
            } else {
                // Remote storage: upload burned file
                const burnedKey = `users/${userId}/clips/${clipId}/clip_burned.mp4`;
                await storage.save(burnedKey, burnedTmp);
                if (clip.asset) {
                    await prisma.videoAsset.update({
                        where: { id: clip.asset.id },
                        data: { storagePath: burnedKey },
                    });
                }
            }
        } finally {
            await fs.rm(tmpDir, { recursive: true, force: true });
        }

        // Mark job complete
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

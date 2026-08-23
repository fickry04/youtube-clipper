/**
 * workers/processors/subtitle.processor.ts
 *
 * For a given clip:
 *   1. Check that 9:16 vertical video exists
 *   2. Load transcript segments that overlap the clip's time range
 *   3. Build moving pill ASS captions (short 2-3 word dynamic chunks) + standard SRT
 *   4. Burn moving pill captions into the 9:16 vertical video with FFmpeg
 *   5. Save the burned vertical video to storage (`clip_vertical_subtitled.mp4`)
 *   6. Persist SRT to database & storage ONLY after burning succeeds
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
// Helpers: SRT & ASS Moving Pill Captions
// ---------------------------------------------------------------------------

/**
 * Format seconds to SRT timestamp: HH:MM:SS,mmm
 */
function toSrtTime(seconds: number): string {
    const totalMs = Math.max(0, Math.round(seconds * 1000));
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

/**
 * Format seconds to ASS timestamp: H:MM:SS.cc
 */
function toAssTime(seconds: number): string {
    const totalCs = Math.max(0, Math.round(seconds * 100));
    const cs = totalCs % 100;
    const totalSec = Math.floor(totalCs / 100);
    const s = totalSec % 60;
    const totalMin = Math.floor(totalSec / 60);
    const m = totalMin % 60;
    const h = Math.floor(totalMin / 60);
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

interface MovingPillCue {
    startSec: number;
    endSec: number;
    text: string;
}

/**
 * Generate punchy, word-chunked cues (2-3 words per pill) for dynamic short-form moving captions
 */
function generateMovingPillCues(
    overlappingSegments: Array<{ offset: number; duration: number; text: string }>,
    clipStart: number,
    clipDuration: number
): MovingPillCue[] {
    const cues: MovingPillCue[] = [];

    for (const seg of overlappingSegments) {
        const text = seg.text.replace(/\n/g, ' ').trim();
        const words = text.split(/\s+/).filter(Boolean);
        if (words.length === 0) continue;

        const segStart = Math.max(0, seg.offset - clipStart);
        const segEnd = Math.min(clipDuration, seg.offset + seg.duration - clipStart);
        const totalDuration = Math.max(0.2, segEnd - segStart);

        // Group into 2 to 3 words per chunk for energetic moving pill captions
        const chunkSize = words.length <= 3 ? words.length : 3;
        const chunks: string[] = [];
        for (let i = 0; i < words.length; i += chunkSize) {
            chunks.push(words.slice(i, i + chunkSize).join(' '));
        }

        const totalChars = chunks.reduce((acc, c) => acc + c.length, 0) || 1;
        let currentStart = segStart;

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const weight = chunk.length / totalChars;
            const chunkDuration = i === chunks.length - 1
                ? Math.max(0.15, segEnd - currentStart)
                : Math.max(0.2, totalDuration * weight);
            const chunkEnd = Math.min(clipDuration, currentStart + chunkDuration);

            cues.push({
                startSec: currentStart,
                endSec: Math.max(currentStart + 0.15, chunkEnd),
                text: chunk.toUpperCase(),
            });

            currentStart = chunkEnd;
        }
    }

    return cues;
}

/**
 * Build standard SRT string from cues
 */
function buildSrt(cues: MovingPillCue[]): string {
    return cues
        .map((c, idx) =>
            `${idx + 1}\n${toSrtTime(c.startSec)} --> ${toSrtTime(c.endSec)}\n${c.text}`
        )
        .join('\n\n');
}

/**
 * Build styled ASS script for moving pill captions positioned in the lower-middle of 9:16 screen
 */
function buildAss(cues: MovingPillCue[]): string {
    const header = `[Script Info]
Title: Moving Pill Subtitles (9:16 Vertical)
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: 720
PlayResY: 1280

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: MovingPill,Arial,28,&H00FFFFFF,&H000000FF,&H00000000,&HA0111111,-1,0,0,0,100,100,0.5,0,3,6,0,2,40,40,240,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    const events = cues.map((c) =>
        `Dialogue: 0,${toAssTime(c.startSec)},${toAssTime(c.endSec)},MovingPill,,0,0,0,,{\\b1}${c.text}`
    ).join('\n');

    return header + events;
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

async function setSubtitleProgress(jobId: string, job: Job<GenerateSubtitlePayload>, progress: number) {
    await job.updateProgress(progress);
    await prisma.job.update({
        where: { id: jobId },
        data: { progress },
    }).catch(() => { });
}

export async function processSubtitle(job: Job<GenerateSubtitlePayload>): Promise<void> {
    const { jobId, userId, clipId } = job.data;

    await prisma.job.update({
        where: { id: jobId },
        data: { status: 'PROCESSING', progress: 10, startedAt: new Date(), attempts: { increment: 1 } },
    });

    await setSubtitleProgress(jobId, job, 10);

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
        const segments = (transcript?.segments as unknown as Array<{ offset: number; duration: number; text: string; lang?: string }>) ?? [];
        if (!transcript || !Array.isArray(segments) || segments.length === 0) {
            throw new Error('Segmen transkrip tidak tersedia untuk pembuatan subtitle.');
        }

        const clipStart = clip.startSeconds;
        const clipEnd = clip.endSeconds;

        // Filter overlapping segments
        const overlapping = segments.filter((s) => {
            const segStart = s.offset;
            const segEnd = s.offset + s.duration;
            return segEnd > clipStart && segStart < clipEnd;
        });

        if (overlapping.length === 0) {
            throw new Error('Tidak ada transkrip yang cocok dalam rentang waktu klip ini.');
        }

        await setSubtitleProgress(jobId, job, 30);

        // 3. Build moving pill cues, ASS and SRT content
        const cues = generateMovingPillCues(overlapping, clipStart, clip.durationSeconds);
        const srtContent = buildSrt(cues);
        const assContent = buildAss(cues);

        await setSubtitleProgress(jobId, job, 50);

        // 4. Burn subtitles into 9:16 vertical video with FFmpeg
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `vc-sub-${clipId}-`));
        const assTmpPath = path.join(tmpDir, 'moving_pill.ass');
        const burnedVerticalTmp = path.join(tmpDir, 'burned_vertical.mp4');

        await fs.writeFile(assTmpPath, assContent, 'utf-8');

        let verticalPath: string;
        if (storage instanceof LocalStorageService) {
            verticalPath = storage.getAbsolutePath(verticalKey);
        } else {
            verticalPath = await storage.get(verticalKey);
        }

        await setSubtitleProgress(jobId, job, 65);

        try {
            await burnSubtitle({
                videoPath: verticalPath,
                srtPath: assTmpPath,
                outputPath: burnedVerticalTmp,
            });

            await setSubtitleProgress(jobId, job, 85);

            // 5. Save burned vertical video to storage
            const subtitledVerticalKey = StorageKeys.clipVerticalSubtitled(userId, clipId);
            await storage.save(subtitledVerticalKey, burnedVerticalTmp);

            // 6. Save SRT file to storage and persist Subtitle in database
            const srtKey = StorageKeys.clipSubtitle(userId, clipId);
            await storage.saveBuffer(srtKey, srtContent, 'utf-8');

            await prisma.subtitle.upsert({
                where: { clipId_format: { clipId, format: 'srt' } },
                update: { content: srtContent, updatedAt: new Date() },
                create: { clipId, format: 'srt', content: srtContent },
            });

            await setSubtitleProgress(jobId, job, 95);
        } finally {
            await fs.rm(tmpDir, { recursive: true, force: true });
        }

        // 7. Mark job complete
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

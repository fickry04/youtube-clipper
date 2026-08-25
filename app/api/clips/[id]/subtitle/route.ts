/**
 * GET  /api/clips/[id]/subtitle  — fetch SRT or Remotion word-level cues (with local Whisper extraction)
 * POST /api/clips/[id]/subtitle  — enqueue subtitle generation worker job
 *
 * Ownership chain: clip → viralAnalysis → video → project → user
 */

import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { getStorage, StorageKeys, LocalStorageService } from '@/lib/storage';
import { getQueue, QUEUE_NAMES } from '@/lib/queue';
import { cuesToSrt, generateWordLevelCues, groupWordsIntoCues } from '@/lib/transcript/word-timestamps';
import { transcribeClipLocally } from '@/lib/whisper';
import type { GenerateSubtitlePayload } from '@/lib/queue/jobs';
import type { CaptionCue, SubtitleStyleConfig } from '@/remotion/types';
import type { TranscriptSegment } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch (err) {
    return err as Response;
  }

  const { id: clipId } = await params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') ?? 'cues';
  const wordsPerPage = parseInt(searchParams.get('wordsPerPage') ?? '3', 10);

  try {
    // Ownership check & load clip with transcript
    const clip = await prisma.clip.findFirst({
      where: {
        id: clipId,
        viralAnalysis: {
          video: { project: { userId: session.user.id } },
        },
      },
      include: {
        subtitles: true,
        viralAnalysis: {
          include: {
            video: {
              include: {
                transcript: true,
              },
            },
          },
        },
      },
    });

    if (!clip) {
      return Response.json(
        { success: false, error: 'Clip not found or access denied.' },
        { status: 404 }
      );
    }

    // 1. Check if there is saved Remotion metadata JSON
    const jsonSub = clip.subtitles.find((s) => s.format === 'json');
    let savedCues: CaptionCue[] | null = null;
    let savedStyleConfig: SubtitleStyleConfig | null = null;

    if (jsonSub && jsonSub.content) {
      try {
        const parsed = JSON.parse(jsonSub.content);
        if (Array.isArray(parsed.cues)) savedCues = parsed.cues;
        if (parsed.styleConfig) savedStyleConfig = parsed.styleConfig;
      } catch { }
    }

    let cues = savedCues;
    if (savedCues && savedCues.length > 0) {
      const allWords = savedCues.flatMap((c: CaptionCue) => c.words || []);
      if (allWords.length > 0) {
        cues = groupWordsIntoCues(allWords, wordsPerPage, clip.durationSeconds);
      }
    }

    // 2. If no saved cues exist yet, try running local Whisper on the clip file
    if (!cues || cues.length === 0) {
      const storage = getStorage();
      const verticalKey = StorageKeys.clipVertical(session.user.id, clipId);
      const originalKey = StorageKeys.clipVideo(session.user.id, clipId);

      let mediaPath: string | null = null;
      if (await storage.exists(verticalKey)) {
        mediaPath = storage instanceof LocalStorageService
          ? storage.getAbsolutePath(verticalKey)
          : await storage.get(verticalKey);
      } else if (await storage.exists(originalKey)) {
        mediaPath = storage instanceof LocalStorageService
          ? storage.getAbsolutePath(originalKey)
          : await storage.get(originalKey);
      }

      const transcript = clip.viralAnalysis.video.transcript;
      let rawSegments: TranscriptSegment[] = [];
      if (transcript?.segments) {
        if (typeof transcript.segments === 'string') {
          try {
            rawSegments = JSON.parse(transcript.segments);
          } catch { }
        } else if (Array.isArray(transcript.segments)) {
          rawSegments = transcript.segments as unknown as TranscriptSegment[];
        }
      }

      if (mediaPath) {
        cues = await transcribeClipLocally({
          mediaPath,
          clipDurationSeconds: clip.durationSeconds,
          wordsPerPage,
          contextHint: `${clip.title} — ${clip.summary}`,
          fallbackSegments: rawSegments,
          clipStartSeconds: clip.startSeconds,
        });
      } else {
        cues = generateWordLevelCues(
          rawSegments,
          clip.startSeconds,
          clip.durationSeconds,
          wordsPerPage
        );
      }

      // Cache the generated cues in database
      if (cues && cues.length > 0) {
        await prisma.subtitle.upsert({
          where: { clipId_format: { clipId, format: 'json' } },
          update: {
            content: JSON.stringify({ cues, styleConfig: savedStyleConfig, updatedAt: new Date().toISOString() }),
            updatedAt: new Date(),
          },
          create: {
            clipId,
            format: 'json',
            content: JSON.stringify({ cues, styleConfig: savedStyleConfig, updatedAt: new Date().toISOString() }),
          },
        }).catch(() => { });
      }
    }

    if (format === 'cues' || format === 'json') {
      return Response.json({
        success: true,
        clipId,
        cues: cues || [],
        styleConfig: savedStyleConfig,
        duration: clip.durationSeconds,
        title: clip.title,
      });
    }

    if (format === 'srt') {
      const dbSrt = clip.subtitles.find((s) => s.format === 'srt')?.content;
      const srtContent = dbSrt || (cues ? cuesToSrt(cues) : '');

      return new Response(srtContent, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'private, max-age=3600',
        },
      });
    }

    return Response.json({
      success: true,
      clipId,
      cues: cues || [],
      styleConfig: savedStyleConfig,
      duration: clip.durationSeconds,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch subtitle cues.';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — enqueue subtitle generation worker job
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch (err) {
    return err as Response;
  }

  const { id: clipId } = await params;

  let aspectRatio: '16:9' | '9:16' | 'all' = '9:16';
  let styleConfig: SubtitleStyleConfig | undefined = undefined;
  try {
    const body = await request.json().catch(() => ({}));
    if (body.aspectRatio) aspectRatio = body.aspectRatio;
    if (body.styleConfig) styleConfig = body.styleConfig;
  } catch {
    // Ignore JSON parsing errors and use default
  }

  const clip = await prisma.clip.findFirst({
    where: {
      id: clipId,
      viralAnalysis: {
        video: { project: { userId: session.user.id } },
      },
    },
    include: {
      viralAnalysis: { select: { videoId: true } },
      asset: { select: { id: true } },
    },
  });

  if (!clip) {
    return Response.json(
      { success: false, error: 'Clip not found or access denied.' },
      { status: 404 }
    );
  }

  if (!clip.asset) {
    return Response.json(
      { success: false, error: 'Klip belum memiliki video asset. Silakan download klip terlebih dahulu.' },
      { status: 422 }
    );
  }

  const storage = getStorage();
  const verticalKey = StorageKeys.clipVertical(session.user.id, clipId);
  const hasVertical = await storage.exists(verticalKey);
  if (!hasVertical) {
    return Response.json(
      { success: false, error: 'Video vertikal 9:16 belum dibuat. Lakukan Auto-Crop 9:16 (Face AI) terlebih dahulu.' },
      { status: 422 }
    );
  }

  try {
    const videoId = clip.viralAnalysis.videoId;

    const job = await prisma.job.create({
      data: {
        userId: session.user.id,
        videoId,
        type: 'GENERATE_SUBTITLE',
        status: 'QUEUED',
        payload: JSON.stringify({ clipId, aspectRatio, styleConfig }),
      },
    });

    await getQueue(QUEUE_NAMES.SUBTITLE).add(
      'subtitle',
      {
        jobId: job.id,
        videoId,
        userId: session.user.id,
        clipId,
        aspectRatio,
        styleConfig,
      } satisfies GenerateSubtitlePayload,
      { jobId: job.id }
    );

    return Response.json({ success: true, jobId: job.id }, { status: 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to enqueue subtitle job.';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

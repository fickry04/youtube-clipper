/**
 * GET  /api/clips/[id]/subtitle  — fetch SRT or Remotion word-level cues (with local Whisper extraction)
 *
 * Ownership chain: clip → viralAnalysis → video → project → user
 */

import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { getStorage, StorageKeys, LocalStorageService } from '@/lib/storage';
import { cuesToSrt, generateWordLevelCues, groupWordsIntoCues } from '@/lib/transcript/word-timestamps';
import { transcribeClip } from '@/lib/whisper';
import type { CaptionCue, SubtitleStyleConfig } from '@/remotion/types';
import type { TranscriptSegment } from '@/lib/types';
import { parseTranscriptSegments } from '@/lib/utils';

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
  const requestedEngine = (searchParams.get('engine') as 'whisper' | 'gemini') || undefined;
  const doTrancscribe = searchParams.get('doTrancscribe') === 'true';

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

    let cues: CaptionCue[] | null = null;
    let hasExistingSubtitle = false;

    if (savedCues && savedCues.length > 0) {
      hasExistingSubtitle = true;
      if (!doTrancscribe) {
        const allWords = savedCues.flatMap((c: CaptionCue) => c.words || []);
        if (allWords.length > 0) {
          cues = groupWordsIntoCues(allWords, wordsPerPage, clip.durationSeconds);
        } else {
          cues = savedCues;
        }
      }
    }

    // 2. Only run STT if doTranscribe is explicitly true
    if (doTrancscribe) {
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
      console.log(mediaPath)

      const transcript = clip.viralAnalysis.video.transcript;
      const rawSegments: TranscriptSegment[] = parseTranscriptSegments(transcript?.segments);

      const selectedEngine: 'whisper' | 'gemini' = requestedEngine || savedStyleConfig?.sttEngine || 'whisper';

      // Create a job record
      const job = await prisma.job.create({
        data: {
          userId: session.user.id,
          videoId: clip.viralAnalysis.videoId,
          type: 'AI_TRANSCRIPT',
          status: 'PROCESSING',
          startedAt: new Date(),
          progress: 15,
        },
      });

      if (mediaPath) {
        cues = await transcribeClip({
          mediaPath,
          clipDurationSeconds: clip.durationSeconds,
          wordsPerPage,
          contextHint: `${clip.title} — ${clip.summary}`,
          fallbackSegments: rawSegments,
          clipStartSeconds: clip.startSeconds,
          engine: selectedEngine,
        });
      } else {
        cues = generateWordLevelCues(
          rawSegments,
          clip.startSeconds,
          clip.durationSeconds,
          wordsPerPage
        );
      }

      const updatedStyleConfig: SubtitleStyleConfig = {
        preset: 'plain',
        fontSize: 48,
        positionY: 75,
        highlightColor: '#FFFFFF',
        textColor: '#FFFFFF',
        strokeColor: '#000000',
        strokeWidth: 4,
        uppercase: true,
        wordsPerPage,
        timeOffset: 0,
        ...savedStyleConfig,
        sttEngine: selectedEngine,
      };

      // Cache the generated cues in database
      if (cues && cues.length > 0) {
        hasExistingSubtitle = true;
        await prisma.subtitle.upsert({
          where: { clipId_format: { clipId, format: 'json' } },
          update: {
            content: JSON.stringify({ cues, styleConfig: updatedStyleConfig, updatedAt: new Date().toISOString() }),
            updatedAt: new Date(),
          },
          create: {
            clipId,
            format: 'json',
            content: JSON.stringify({ cues, styleConfig: updatedStyleConfig, updatedAt: new Date().toISOString() }),
          },
        });
      }
      savedStyleConfig = updatedStyleConfig;

      // Mark job as completed
      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'COMPLETED', progress: 100, completedAt: new Date() },
      });
    }

    if (format === 'cues' || format === 'json') {
      return Response.json({
        success: true,
        clipId,
        hasExistingSubtitle,
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
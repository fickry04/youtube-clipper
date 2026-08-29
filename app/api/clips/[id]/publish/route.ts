import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getQueue, QUEUE_NAMES } from '@/lib/queue';
import { SocialPublishJobPayload } from '@/lib/queue/jobs';

export async function POST(
  request: NextRequest,
) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return Response.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 401 },
      );
    }

    const body = await request.json();

    const {
      clipId,
      platform,
      accountId,
      caption,
      videoVariant = 'VERTICAL_SUBTITLED',
    } = body;

    if (!platform) {
      return Response.json(
        {
          success: false,
          error: 'Platform wajib diisi.',
        },
        { status: 400 },
      );
    }

    if (!accountId) {
      return Response.json(
        {
          success: false,
          error: 'Account ID wajib diisi.',
        },
        { status: 400 },
      );
    }

    // Pastikan clip milik user
    const clip = await prisma.clip.findFirst({
      where: {
        id: clipId,

        viralAnalysis: {
          video: {
            project: {
              userId: session.user.id,
            }
          }
        },
      },
      select: {
        id: true,
        processingStatus: true
      }
    });

    if (!clip) {
      return Response.json(
        {
          success: false,
          error: 'Clip tidak ditemukan.',
        },
        { status: 404 },
      );
    }

    if (clip.processingStatus !== 'COMPLETED') {
      return Response.json(
        {
          success: false,
          error: 'Video belum selesai diproses.',
        },
        { status: 400 },
      );
    }

    // Pastikan account milik user
    const account = await prisma.socialAccount.findFirst({
      where: {
        id: accountId,
        userId: session.user.id,
        platform,
      },
    });

    if (!account) {
      return Response.json(
        {
          success: false,
          error: 'Social account tidak ditemukan.',
        },
        { status: 404 },
      );
    }

    // Buat database job
    const job = await prisma.job.create({
      data: {
        userId: session.user.id,
        type: 'SOCIAL_PUBLISH',
        status: 'QUEUED',

        payload: {
          clipId,
          accountId,
          platform,
          caption,
          videoVariant,
        },
      },
    });

    // Masukkan ke BullMQ
    await getQueue(QUEUE_NAMES.SOCIAL_PUBLISH).add(
      'social-publish',
      {
        jobId: job.id,
        userId: session.user.id,
        clipId,
        accountId,
        platform,
        caption,
        videoVariant,
      } satisfies SocialPublishJobPayload,
      { jobId: job.id }
    );

    return Response.json(
      {
        success: true,
        jobId: job.id,
        status: 'QUEUED',
      },
      { status: 202 },
    );
  } catch (error) {
    console.error(
      'Create social publish job error:',
      error,
    );

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Gagal membuat publish job.',
      },
      { status: 500 },
    );
  }
}
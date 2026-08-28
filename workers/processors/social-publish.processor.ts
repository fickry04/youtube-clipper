import type { Job as BullJob } from 'bullmq';
import prisma from '@/lib/prisma';

import type {
  SocialPlatform,
} from '@/lib/social/platforms';

// import {
//   publishYouTube,
// } from './social/youtube';

// import {
//   publishTikTok,
// } from './social/tiktok';

// import {
//   publishInstagram,
// } from './social/instagram';

// import {
//   publishX,
// } from './social/x';

// import {
//   publishThreads,
// } from './social/threads';

// import {
//   publishFacebook,
// } from './social/facebook';

interface SocialPublishJobPayload {
  clipId: string;
  accountId: string;

  platform: SocialPlatform;

  caption: {
    hook: string;
    description: string;
  };

  videoVariant:
  | 'ORIGINAL'
  | 'VERTICAL'
  | 'VERTICAL_SUBTITLED';
}

export async function processSocialPublish(
  bullJob: BullJob,
) {
  const { jobId } = bullJob.data;

  const job = await prisma.job.findUnique({
    where: {
      id: jobId,
    },
  });

  if (!job) {
    throw new Error(
      `Database job ${jobId} tidak ditemukan.`,
    );
  }

  const payload = job.payload as unknown as SocialPublishJobPayload;

  await prisma.job.update({
    where: {
      id: jobId,
    },
    data: {
      status: 'PROCESSING',
      progress: 5,
      startedAt: new Date(),
      attempts: {
        increment: 1,
      },
    },
  });

  try {
    const account =
      await prisma.socialAccount.findUnique({
        where: {
          id: payload.accountId,
        },
      });

    if (!account) {
      throw new Error(
        'Social account tidak ditemukan.',
      );
    }

    const videoUrl = buildInternalVideoUrl(
      payload.clipId,
      payload.videoVariant,
    );

    let result;

    // switch (payload.platform) {
    //   case 'YOUTUBE':
    //     result = await publishYouTube({
    //       account,
    //       videoUrl,
    //       caption: payload.caption,
    //     });
    //     break;

    //   case 'TIKTOK':
    //     result = await publishTikTok({
    //       account,
    //       videoUrl,
    //       caption: payload.caption,
    //     });
    //     break;

    //   case 'INSTAGRAM':
    //     result = await publishInstagram({
    //       account,
    //       videoUrl,
    //       caption: payload.caption,
    //     });
    //     break;

    //   case 'X':
    //     result = await publishX({
    //       account,
    //       videoUrl,
    //       caption: payload.caption,
    //     });
    //     break;

    //   case 'THREADS':
    //     result = await publishThreads({
    //       account,
    //       videoUrl,
    //       caption: payload.caption,
    //     });
    //     break;

    //   case 'FACEBOOK':
    //     result = await publishFacebook({
    //       account,
    //       videoUrl,
    //       caption: payload.caption,
    //     });
    //     break;

    //   default:
    //     throw new Error(
    //       `Platform tidak didukung: ${payload.platform}`,
    //     );
    // }

    await prisma.job.update({
      where: {
        id: jobId,
      },
      data: {
        status: 'COMPLETED',
        progress: 100,
        completedAt: new Date(),

        payload: {
          ...payload,
          result,
        },
      },
    });

    return result;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unknown error';

    await prisma.job.update({
      where: {
        id: jobId,
      },
      data: {
        status: 'FAILED',
        error: message,
      },
    });

    throw error;
  }
}

function buildInternalVideoUrl(
  clipId: string,
  variant: SocialPublishJobPayload['videoVariant'],
): string {
  const baseUrl =
    process.env.APP_URL ??
    'http://localhost:3000';

  switch (variant) {
    case 'ORIGINAL':
      return `${baseUrl}/api/clips/${clipId}/video`;

    case 'VERTICAL':
      return `${baseUrl}/api/clips/${clipId}/vertical`;

    case 'VERTICAL_SUBTITLED':
      return (
        `${baseUrl}/api/clips/${clipId}/vertical` +
        '?subtitled=true'
      );
  }
}
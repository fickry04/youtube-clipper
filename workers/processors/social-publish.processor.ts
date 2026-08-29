import path from 'node:path';

import prisma from '@/lib/prisma';
import {
  getValidYoutubeCredentials,
  uploadVideoToYouTube,
} from '@/workers/processors/social/youtube.processor';
import { Job } from 'bullmq';
import type { SocialPublishJobPayload } from '@/lib/queue/jobs';
import { setJobProgress } from '..';

export async function processSocialPublish(
  job: Job<SocialPublishJobPayload>,
): Promise<{ success: boolean; videoId?: string }> {
  const {
    jobId,
    userId,
    clipId,
    accountId,
    caption,
    platform,
    videoVariant,
  } = job.data;

  // 1. Ambil social account
  const account = await prisma.socialAccount.findFirst({
    where: {
      id: accountId,
    },
  });

  await setJobProgress(jobId, job, 20)

  if (!account || !account.encryptedCredential) {
    throw new Error('Social account not found or not authorized');
  }

  // 2. Ambil clip
  const clip = await prisma.clip.findFirst({
    where: {
      id: clipId,
    },
  });

  if (!clip) {
    throw new Error('Clip not found');
  }

  await setJobProgress(jobId, job, 40)


  // 3. Tentukan nama file berdasarkan variant
  let fileName: string;

  switch (videoVariant) {
    case 'VERTICAL_SUBTITLED':
      fileName = 'clip_vertical_subtitled.mp4';
      break;

    case 'VERTICAL':
      fileName = 'clip_vertical.mp4';
      break;

    case 'ORIGINAL':
      fileName = 'clip.mp4';
      break;

    default:
      throw new Error(
        `Unsupported video variant: ${videoVariant}`,
      );
  }

  await setJobProgress(jobId, job, 60)

  // 4. Tentukan path video
  const storageRoot =
    process.env.STORAGE_PATH || path.join(process.cwd(), 'storage');

  const videoPath = path.join(
    storageRoot,
    'users',
    userId,
    'clips',
    clip.id,
    fileName,
  );

  console.log(
    `[Worker] Video path: ${videoPath}`,
  );

  await setJobProgress(jobId, job, 80)

  // 5. Upload ke platform
  if (platform === 'YOUTUBE') {
    console.log(
      `[Worker] Uploading clip ${clipId} to YouTube using ${videoVariant} variant...`,
    );

    const accessToken = await getValidYoutubeCredentials(
      account.encryptedCredential,
    );

    const videoId = await uploadVideoToYouTube(
      accessToken,
      videoPath,
      caption.hook,
      caption.description,
    );

    await setJobProgress(jobId, job, 100)

    await prisma.job.update({
      where: {
        id: jobId,
      },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      }
    })

    console.log(
      `[Worker] Successfully uploaded clip ${clipId} to YouTube. Video ID: ${videoId}`,
    );

    return {
      success: true,
      videoId,
    };
  }

  throw new Error(
    `Platform ${platform} is not supported yet`,
  );
}
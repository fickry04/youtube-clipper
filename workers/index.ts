/**
 * workers/index.ts
 *
 * Worker entry point — registers all BullMQ processors and starts consuming.
 * Run with: npm run worker  (tsx workers/index.ts)
 */

import 'dotenv/config'; // load .env before anything else
import { Worker } from 'bullmq';
import { getRedisConnection, QUEUE_NAMES } from '../lib/queue';
import { processClips } from './processors/clip.processor';
import { processSubtitle } from './processors/subtitle.processor';
import { processFaceDetection } from './processors/face.processor';

// ---------------------------------------------------------------------------
// Worker configuration
// ---------------------------------------------------------------------------

const connection = getRedisConnection();

// ---------------------------------------------------------------------------
// Active Workers
// ---------------------------------------------------------------------------

// Standard options for CPU/IO heavy video and AI workloads
const heavyWorkerOptions = {
  connection,
  concurrency: 1, // serial: yt-dlp, AI model & FFmpeg are CPU-heavy
  lockDuration: 300_000, // 5 minutes lock TTL (prevents lock loss during AI inference/FFmpeg)
  stalledInterval: 60_000, // Check stalled jobs every 60s
  maxStalledCount: 3, // Allow up to 3 recoveries before failing
};

const clipWorker = new Worker(
  QUEUE_NAMES.CLIP,
  async (job) => processClips(job as Parameters<typeof processClips>[0]),
  heavyWorkerOptions
);

const subtitleWorker = new Worker(
  QUEUE_NAMES.SUBTITLE,
  async (job) => processSubtitle(job as Parameters<typeof processSubtitle>[0]),
  heavyWorkerOptions
);

const faceWorker = new Worker(
  QUEUE_NAMES.FACE_DETECTION,
  async (job) => processFaceDetection(job as Parameters<typeof processFaceDetection>[0]),
  heavyWorkerOptions
);

// ---------------------------------------------------------------------------
// Lifecycle logging
// ---------------------------------------------------------------------------

const workers = [
  { worker: clipWorker, name: 'clip' },
  { worker: subtitleWorker, name: 'subtitle' },
  { worker: faceWorker, name: 'face' },
];

for (const { worker, name } of workers) {
  worker.on('completed', (job) => {
    console.log(`[${name}] ✓ Job ${job.id} completed.`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[${name}] ✗ Job ${job?.id} failed: ${err.message}`);
  });

  worker.on('error', (err) => {
    console.error(`[${name}] Worker error: ${err.message}`);
  });
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

async function shutdown() {
  console.log('\n[worker] Shutting down gracefully…');
  await Promise.all(workers.map(({ worker }) => worker.close()));
  await connection.quit();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log(`[worker] Started — queues: ${workers.map((w) => w.name).join(', ')}`);

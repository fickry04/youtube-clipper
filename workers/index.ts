/**
 * workers/index.ts
 *
 * Worker entry point — registers all BullMQ processors and starts consuming.
 * Run with: npm run worker  (tsx workers/index.ts)
 */

import 'dotenv/config'; // load .env before anything else
import { Worker } from 'bullmq';
import { getRedisConnection, QUEUE_NAMES } from '../lib/queue';
import { processVideoDownload } from './processors/video.processor';
import { processTranscript } from './processors/transcript.processor';
import { processAnalysis } from './processors/analysis.processor';
import { processClips } from './processors/clip.processor';
import { processSubtitle } from './processors/subtitle.processor';

// ---------------------------------------------------------------------------
// Worker configuration
// ---------------------------------------------------------------------------

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? '2');

const connection = getRedisConnection();

// ---------------------------------------------------------------------------
// Workers
// ---------------------------------------------------------------------------

const videoWorker = new Worker(
  QUEUE_NAMES.VIDEO,
  async (job) => processVideoDownload(job as Parameters<typeof processVideoDownload>[0]),
  { connection, concurrency: 1 } // serial: disk space limited
);

const transcriptWorker = new Worker(
  QUEUE_NAMES.TRANSCRIPT,
  async (job) => processTranscript(job as Parameters<typeof processTranscript>[0]),
  { connection, concurrency: CONCURRENCY }
);

const analysisWorker = new Worker(
  QUEUE_NAMES.ANALYSIS,
  async (job) => processAnalysis(job as Parameters<typeof processAnalysis>[0]),
  { connection, concurrency: CONCURRENCY }
);

const clipWorker = new Worker(
  QUEUE_NAMES.CLIP,
  async (job) => processClips(job as Parameters<typeof processClips>[0]),
  { connection, concurrency: 1 } // serial: FFmpeg is CPU-heavy
);

const subtitleWorker = new Worker(
  QUEUE_NAMES.SUBTITLE,
  async (job) => processSubtitle(job as Parameters<typeof processSubtitle>[0]),
  { connection, concurrency: 1 } // serial: FFmpeg is CPU-heavy
);

// ---------------------------------------------------------------------------
// Lifecycle logging
// ---------------------------------------------------------------------------

const workers = [
  { worker: videoWorker, name: 'video' },
  { worker: transcriptWorker, name: 'transcript' },
  { worker: analysisWorker, name: 'analysis' },
  { worker: clipWorker, name: 'clip' },
  { worker: subtitleWorker, name: 'subtitle' },
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
console.log(`[worker] Concurrency: ${CONCURRENCY} (video/clip: 1)`);

import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { QUEUE_NAMES } from './jobs';

// =============================================================================
// REDIS CONNECTION
// =============================================================================

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

// Global singleton for Next.js hot-reload compatibility
const globalForRedis = globalThis as unknown as {
  redisConnection: IORedis | undefined;
};

export function getRedisConnection(): IORedis {
  if (!globalForRedis.redisConnection) {
    globalForRedis.redisConnection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
    });
  }
  return globalForRedis.redisConnection;
}

// =============================================================================
// BULLMQ QUEUES
// =============================================================================

const globalForQueues = globalThis as unknown as {
  queues: Record<string, Queue> | undefined;
};

function createQueue(name: string): Queue {
  return new Queue(name, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000, // 2s, 4s, 8s
      },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  });
}

function getQueues(): Record<string, Queue> {
  if (!globalForQueues.queues) {
    globalForQueues.queues = {
      [QUEUE_NAMES.VIDEO]: createQueue(QUEUE_NAMES.VIDEO),
      [QUEUE_NAMES.TRANSCRIPT]: createQueue(QUEUE_NAMES.TRANSCRIPT),
      [QUEUE_NAMES.ANALYSIS]: createQueue(QUEUE_NAMES.ANALYSIS),
      [QUEUE_NAMES.CLIP]: createQueue(QUEUE_NAMES.CLIP),
      [QUEUE_NAMES.SUBTITLE]: createQueue(QUEUE_NAMES.SUBTITLE),
      [QUEUE_NAMES.FACE_DETECTION]: createQueue(QUEUE_NAMES.FACE_DETECTION),
      [QUEUE_NAMES.EMBEDDING]: createQueue(QUEUE_NAMES.EMBEDDING),
    };
  }
  return globalForQueues.queues;
}

export function getQueue(name: string): Queue {
  const queues = getQueues();
  const queue = queues[name];
  if (!queue) {
    throw new Error(`Unknown queue: "${name}"`);
  }
  return queue;
}

export { QUEUE_NAMES };

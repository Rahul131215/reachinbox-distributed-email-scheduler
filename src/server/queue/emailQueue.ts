import { Queue, QueueEvents, Job } from 'bullmq';
import { getRedisClient } from '../redis/redisClient';

export const EMAIL_QUEUE_NAME = 'reachinbox-email-queue';

export interface EmailJobData {
  jobId: string;
  tenantId: string;
  campaignId?: string;
  recipient: string;
  sender: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  scheduledFor: number;
  idempotencyKey: string;
  metadata?: Record<string, any>;
}

let emailQueueInstance: Queue<EmailJobData> | null = null;
let queueEventsInstance: QueueEvents | null = null;

export function getEmailQueue(): Queue<EmailJobData> {
  if (!emailQueueInstance) {
    const connection = getRedisClient();
    emailQueueInstance = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
      connection: connection as any,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
        removeOnComplete: {
          age: 86400, // 24 hours
          count: 5000,
        },
        removeOnFail: {
          age: 604800, // 7 days
          count: 5000,
        },
      },
    });

    emailQueueInstance.on('error', (err) => {
      // Suppress unhandled event error when Redis is offline or reconnecting
      console.warn(`[BullMQ Queue] Connection notice: ${err.message}`);
    });
  }
  return emailQueueInstance;
}

export function getEmailQueueEvents(): QueueEvents {
  if (!queueEventsInstance) {
    const connection = getRedisClient();
    queueEventsInstance = new QueueEvents(EMAIL_QUEUE_NAME, {
      connection: connection as any,
    });

    queueEventsInstance.on('error', (err) => {
      // Suppress unhandled event error when Redis is offline or reconnecting
      console.warn(`[BullMQ QueueEvents] Connection notice: ${err.message}`);
    });
  }
  return queueEventsInstance;
}

export interface ScheduleJobResult {
  queueJobId: string;
  delayMs: number;
  scheduledTime: string;
  isDelayed: boolean;
}

export async function scheduleEmailJob(data: EmailJobData): Promise<ScheduleJobResult> {
  const queue = getEmailQueue();
  const now = Date.now();
  const delayMs = Math.max(0, data.scheduledFor - now);

  const addPromise = queue.add(
    `email:${data.tenantId}:${data.idempotencyKey}`,
    data,
    {
      jobId: `job_${data.idempotencyKey}`,
      delay: delayMs,
    }
  );

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('BullMQ dispatch timeout (500ms)')), 500)
  );

  const job = (await Promise.race([addPromise, timeoutPromise])) as any;

  return {
    queueJobId: job.id || `job_${data.idempotencyKey}`,
    delayMs,
    scheduledTime: new Date(data.scheduledFor).toISOString(),
    isDelayed: delayMs > 0,
  };
}

export async function getQueueMetrics() {
  try {
    const queue = getEmailQueue();
    const metricsPromise = Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getDelayedCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.isPaused(),
    ]);

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('BullMQ connection timeout (600ms)')), 600)
    );

    const [waiting, active, delayed, completed, failed, paused] = (await Promise.race([
      metricsPromise,
      timeoutPromise,
    ])) as [number, number, number, number, number, boolean];

    return {
      connected: true,
      waiting,
      active,
      delayed,
      completed,
      failed,
      isPaused: paused,
      total: waiting + active + delayed + completed + failed,
    };
  } catch (err: any) {
    return {
      connected: false,
      waiting: 0,
      active: 0,
      delayed: 0,
      completed: 0,
      failed: 0,
      isPaused: false,
      total: 0,
      error: err?.message,
    };
  }
}

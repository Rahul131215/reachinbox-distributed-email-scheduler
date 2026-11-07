import { Worker, Job } from 'bullmq';
import { EMAIL_QUEUE_NAME, EmailJobData, getEmailQueue } from './emailQueue';
import { getRedisClient } from '../redis/redisClient';
import { DistributedRateLimiter } from '../redis/rateLimiter';
import { deliverEmail } from '../email/smtpDelivery';
import { EmailSearchService } from '../elasticsearch/emailSearchService';
import { SlackService } from '../slack/slackService';
import { getPrismaClient } from '../db/prismaClient';

let workerInstance: Worker<EmailJobData> | null = null;
let isWorkerRunning = false;

export function getEmailWorker(): Worker<EmailJobData> {
  if (!workerInstance) {
    const connection = getRedisClient();

    workerInstance = new Worker<EmailJobData>(
      EMAIL_QUEUE_NAME,
      async (job: Job<EmailJobData>) => {
        const { data } = job;
        console.log(`[Worker] Processing email job: ${job.id} for recipient: ${data.recipient}`);

        // 1. Enforce atomic rate limit check via Redis Lua script
        try {
          const rateLimit = await DistributedRateLimiter.checkLimit(
            data.tenantId,
            'email_throughput',
            {
              windowMs: 60000, // 1 minute window
              maxRequests: 100, // 100 emails/minute per tenant
              operationId: job.id,
            }
          );

          if (!rateLimit.allowed) {
            console.warn(
              `[Worker] Tenant ${data.tenantId} rate limit hit. Re-scheduling job ${job.id} after ${rateLimit.retryAfterMs}ms`
            );

            // Re-delay job in BullMQ queue
            const queue = getEmailQueue();
            await queue.add(job.name, data, {
              delay: rateLimit.retryAfterMs,
              jobId: `${job.id}_retry_${Date.now()}`,
            });

            // Notify Slack of rate limit event
            await SlackService.sendAlert({
              title: 'Rate Limit Threshold Exceeded',
              severity: 'warning',
              message: `Tenant ${data.tenantId} reached rate limit limit (${rateLimit.limit}/min). Delaying job for ${Math.round(rateLimit.retryAfterMs / 1000)}s.`,
              fields: {
                Tenant: data.tenantId,
                Recipient: data.recipient,
                RetryAfterMs: rateLimit.retryAfterMs,
              },
            });

            return {
              status: 'RATE_LIMITED',
              delayedMs: rateLimit.retryAfterMs,
            };
          }
        } catch (err: any) {
          // If Redis is offline during worker execution, log warning
          console.warn(`[Worker] Rate limit check skipped: ${err.message}`);
        }

        // 2. Dispatch email via SMTP
        const delivery = await deliverEmail({
          to: data.recipient,
          from: data.sender,
          subject: data.subject,
          html: data.bodyHtml,
          text: data.bodyText,
          tenantId: data.tenantId,
          jobId: data.jobId || (job.id as string),
          idempotencyKey: data.idempotencyKey,
        });

        if (!delivery.success) {
          throw new Error(`SMTP Delivery failed: ${delivery.error}`);
        }

        // 3. Update database record if PostgreSQL is connected
        try {
          const prisma = getPrismaClient();
          await prisma.emailJob.updateMany({
            where: {
              idempotencyKey: data.idempotencyKey,
              tenantId: data.tenantId,
            },
            data: {
              status: 'DELIVERED',
              sentAt: new Date(),
              attempts: { increment: 1 },
            },
          });
        } catch (err: any) {
          console.warn(`[Worker] DB update skipped: ${err.message}`);
        }

        // 4. Index in Elasticsearch for full-text search
        try {
          await EmailSearchService.indexEmail({
            id: data.idempotencyKey,
            jobId: data.jobId || (job.id as string),
            tenantId: data.tenantId,
            campaignId: data.campaignId,
            recipient: data.recipient,
            sender: data.sender,
            subject: data.subject,
            bodyText: data.bodyText || data.bodyHtml.replace(/<[^>]*>?/gm, ''),
            status: 'DELIVERED',
            scheduledFor: new Date(data.scheduledFor).toISOString(),
            sentAt: delivery.timestamp,
            idempotencyKey: data.idempotencyKey,
            createdAt: new Date().toISOString(),
          });
        } catch (err: any) {
          console.warn(`[Worker] Elasticsearch indexing skipped: ${err.message}`);
        }

        return {
          status: 'DELIVERED',
          messageId: delivery.messageId,
          timestamp: delivery.timestamp,
        };
      },
      {
        connection: connection as any,
        concurrency: 5,
      }
    );

    workerInstance.on('error', (err: Error) => {
      // Catch connection errors when Redis is offline or restarting
      console.warn(`[Worker] Connection notice: ${err.message}`);
    });

    workerInstance.on('completed', (job: Job) => {
      console.log(`[Worker] Job ${job.id} successfully completed`);
    });

    workerInstance.on('failed', async (job: Job | undefined, err: Error) => {
      console.error(`[Worker] Job ${job?.id} failed with error: ${err.message}`);

      if (job) {
        // Update DB status based on whether retries are exhausted
        const isFinalAttempt =
          job.attemptsMade >= (job.opts.attempts || 3);

        try {
          const prisma = getPrismaClient();

          await prisma.emailJob.updateMany({
            where: {
              idempotencyKey: job.data.idempotencyKey,
              tenantId: job.data.tenantId,
            },
            data: {
              status: isFinalAttempt ? 'FAILED' : 'SCHEDULED',
              lastError: err.message,
              attempts: { increment: 1 },
            },
          });
        } catch (err: any) {
          console.warn(`[Worker] Failed to update job status: ${err.message}`);
        }

        // Send Slack alert on terminal job failure
        if (job.attemptsMade >= (job.opts.attempts || 3)) {
          await SlackService.sendAlert({
            title: 'Email Job Exhausted All Retries (Dead Letter)',
            severity: 'danger',
            message: `Job ${job.id} for recipient ${job.data.recipient} permanently failed.`,
            fields: {
              Recipient: job.data.recipient,
              Tenant: job.data.tenantId,
              Attempts: job.attemptsMade,
              Error: err.message,
            },
          });
        }
      }
    });

    isWorkerRunning = true;
  }

  return workerInstance;
}

export function isWorkerActive(): boolean {
  return isWorkerRunning && workerInstance !== null && !workerInstance.isPaused();
}


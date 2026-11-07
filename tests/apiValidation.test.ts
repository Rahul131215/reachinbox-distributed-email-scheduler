import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

const emailScheduleSchema = z.object({
  recipient: z.string().email(),
  sender: z.string().email().optional(),
  subject: z.string().min(1),
  bodyHtml: z.string().min(1),
  delaySeconds: z.number().int().min(0).optional(),
  scheduledAt: z.string().datetime().optional(),
  tenantId: z.string().min(1),
  campaignId: z.string().optional(),
  idempotencyKey: z.string().min(1),
});

describe('API Input Validation & Payload Schemas', () => {
  it('should accept valid email scheduling payloads', () => {
    const validPayload = {
      recipient: 'subscriber@customer.io',
      subject: 'Weekly Digest',
      bodyHtml: '<p>Your summary</p>',
      tenantId: 'tenant_default',
      idempotencyKey: 'idem_9921_abc',
    };

    const parsed = emailScheduleSchema.safeParse(validPayload);
    assert.equal(parsed.success, true);
  });

  it('should reject invalid recipient email format', () => {
    const invalidPayload = {
      recipient: 'not-an-email',
      subject: 'Hi',
      bodyHtml: '<p>Body</p>',
      tenantId: 'tenant_default',
      idempotencyKey: 'idem_1',
    };

    const parsed = emailScheduleSchema.safeParse(invalidPayload);
    assert.equal(parsed.success, false);
  });

  it('should reject missing subject or empty bodyHtml', () => {
    const invalidPayload = {
      recipient: 'good@email.com',
      subject: '',
      bodyHtml: '',
      tenantId: 'tenant_default',
      idempotencyKey: 'idem_2',
    };

    const parsed = emailScheduleSchema.safeParse(invalidPayload);
    assert.equal(parsed.success, false);
  });
});

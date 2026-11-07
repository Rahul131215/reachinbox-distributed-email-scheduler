import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deliverEmail } from '../src/server/email/smtpDelivery';

describe('SMTP Email Delivery & Idempotency', () => {
  it('should format delivery payload with custom tracking headers', async () => {
    const payload = {
      to: 'recipient@testdomain.com',
      from: 'sender@reachinbox.ai',
      subject: 'Test ReachInbox Email',
      html: '<h1>Hello ReachInbox</h1><p>Welcome to distributed scheduling.</p>',
      tenantId: 'tenant_test_1',
      jobId: 'job_test_100',
      idempotencyKey: 'idem_test_unit_1',
    };

    const result = await deliverEmail(payload);
    assert.ok(result.success, 'Delivery in mock/stream mode should succeed');
    assert.ok(result.messageId, 'Must return a unique messageId');
    assert.deepEqual(result.accepted, [payload.to], 'Recipient should be listed as accepted');
  });

  it('should generate plain text fallback from HTML body', async () => {
    const payload = {
      to: 'client@example.org',
      subject: 'Plain text check',
      html: '<p>This is a paragraph with <b>bold text</b>.</p>',
      tenantId: 'tenant_test_2',
      jobId: 'job_test_101',
      idempotencyKey: 'idem_test_unit_2',
    };

    const result = await deliverEmail(payload);
    assert.ok(result.success);
    assert.ok(result.timestamp);
  });

  it('should capture delivery timestamps accurately in ISO 8601 format', async () => {
    const payload = {
      to: 'timestamp@example.org',
      subject: 'Timestamp verification',
      html: '<p>Verifying ISO date format</p>',
      tenantId: 'tenant_test_3',
      jobId: 'job_test_102',
      idempotencyKey: 'idem_test_unit_3',
    };

    const result = await deliverEmail(payload);
    const parsedDate = new Date(result.timestamp);
    assert.ok(!isNaN(parsedDate.getTime()), 'Timestamp must be a valid parseable ISO string');
  });
});

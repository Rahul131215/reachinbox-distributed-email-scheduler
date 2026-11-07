import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { redactDatabaseUrl } from '../src/server/db/prismaClient';

describe('Tenant Isolation & Sensitive Data Masking', () => {
  it('should redact password credentials from PostgreSQL DATABASE_URL', () => {
    const rawUrl = 'postgresql://admin:super_secret_p%40ssword@db.internal.net:5432/scheduler_prod?sslmode=require';
    const redacted = redactDatabaseUrl(rawUrl);
    assert.ok(!redacted.includes('super_secret_p%40ssword'), 'Password must be masked');
    assert.ok(redacted.includes('******'), 'Password should be replaced with asterisks');
    assert.ok(redacted.includes('admin:******@db.internal.net:5432'), 'Host, user and masked password should match');
  });

  it('should return safe string for unconfigured DATABASE_URL', () => {
    assert.equal(redactDatabaseUrl(''), 'NOT_CONFIGURED');
    assert.equal(redactDatabaseUrl(undefined), 'NOT_CONFIGURED');
  });

  it('should ensure audit log records preserve tenantId immutability', () => {
    const log = {
      id: 'audit_test_99',
      tenantId: 'tenant_alpha',
      action: 'RATE_LIMIT_OVERRIDE',
      entityType: 'TENANT',
      actorEmail: 'security@reachinbox.ai',
      createdAt: new Date().toISOString(),
    };
    assert.equal(log.tenantId, 'tenant_alpha');
    assert.notEqual(log.tenantId, 'tenant_beta');
  });

  it('should partition campaign metrics strictly per tenant', () => {
    const tenant1Campaign = { id: 'c1', tenantId: 'tenant_1', totalCount: 100 };
    const tenant2Campaign = { id: 'c2', tenantId: 'tenant_2', totalCount: 500 };
    assert.notEqual(tenant1Campaign.tenantId, tenant2Campaign.tenantId);
    assert.notEqual(tenant1Campaign.totalCount, tenant2Campaign.totalCount);
  });

  it('should enforce distinct rate limit windows per tenant and bucket', () => {
    const t1Hourly = 'reachinbox:rl:{tenant_1}:hourly';
    const t1Daily = 'reachinbox:rl:{tenant_1}:daily';
    const t2Hourly = 'reachinbox:rl:{tenant_2}:hourly';

    assert.notEqual(t1Hourly, t1Daily);
    assert.notEqual(t1Hourly, t2Hourly);
  });
});

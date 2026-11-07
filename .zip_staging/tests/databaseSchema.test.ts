import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

describe('Prisma PostgreSQL Schema & Data Modeling', () => {
  const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');

  it('should define Tenant model with unique apiKey and slug', () => {
    assert.match(schemaContent, /model Tenant \{/);
    assert.match(schemaContent, /slug\s+String\s+@unique/);
    assert.match(schemaContent, /apiKey\s+String\s+@unique/);
  });

  it('should define User model with tenant relation and role', () => {
    assert.match(schemaContent, /model User \{/);
    assert.match(schemaContent, /role\s+String/);
    assert.match(schemaContent, /tenantId\s+String/);
  });

  it('should define EmailJob model with idempotencyKey and status', () => {
    assert.match(schemaContent, /model EmailJob \{/);
    assert.match(schemaContent, /idempotencyKey\s+String\s+@unique/);
    assert.match(schemaContent, /status\s+String/);
    assert.match(schemaContent, /attempts\s+Int/);
  });

  it('should define RateLimitConfig model for tenant throttling', () => {
    assert.match(schemaContent, /model RateLimitConfig \{/);
    assert.match(schemaContent, /windowSeconds\s+Int/);
    assert.match(schemaContent, /maxRequests\s+Int/);
  });

  it('should define AuditLog model for security tracking', () => {
    assert.match(schemaContent, /model AuditLog \{/);
    assert.match(schemaContent, /actorEmail\s+String/);
    assert.match(schemaContent, /action\s+String/);
  });

  it('should have initial migration file generated in prisma/migrations', () => {
    const migrationPath = path.join(
      process.cwd(),
      'prisma',
      'migrations',
      '20261107000000_init',
      'migration.sql'
    );
    assert.ok(fs.existsSync(migrationPath), 'migration.sql must exist');
    const sqlContent = fs.readFileSync(migrationPath, 'utf8');
    assert.match(sqlContent, /CREATE TABLE "EmailJob"/);
    assert.match(sqlContent, /CREATE TABLE "Tenant"/);
  });
});

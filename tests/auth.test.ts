import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../src/server/auth/authService';

// Test-only JWT secret (never use this secret in production).
process.env.JWT_SECRET =
  'test-only-jwt-secret-at-least-32-characters-long';

describe('Authentication & Security', () => {
  it('should reject empty or missing Google OAuth token', async () => {
    const result = await AuthService.verifyGoogleToken('');

    assert.equal(result.valid, false);
    assert.ok(result.error);
  });

  it('should generate and verify signed JWT session token', () => {
    const user = {
      id: 'usr_abc_123',
      email: 'alex@reachinbox.ai',
      name: 'Alex Rivera',
      role: 'ADMIN' as const,
      tenantId: 'tenant_default',
    };

    const token = AuthService.generateSessionToken(user);

    assert.ok(token && typeof token === 'string');

    const decoded = AuthService.verifySessionToken(token);

    assert.ok(decoded);
    assert.equal(decoded.id, user.id);
    assert.equal(decoded.email, user.email);
    assert.equal(decoded.role, 'ADMIN');
    assert.equal(decoded.tenantId, 'tenant_default');
  });

  it('should reject tampered JWT tokens', () => {
    const user = {
      id: 'usr_xyz',
      email: 'hacker@malicious.com',
      name: 'Bad Actor',
      role: 'MEMBER' as const,
      tenantId: 'tenant_other',
    };

    const token = AuthService.generateSessionToken(user);
    const tampered = token.slice(0, -6) + 'abc123';

    const decoded = AuthService.verifySessionToken(tampered);

    assert.equal(decoded, null, 'Tampered token must return null');
  });

  it('should prevent cross-tenant access in decoded claims', () => {
    const token = AuthService.generateSessionToken({
      id: 'usr_1',
      email: 't1@domain.com',
      name: 'User 1',
      role: 'MEMBER',
      tenantId: 'tenant_alpha',
    });

    const session = AuthService.verifySessionToken(token);

    assert.equal(session?.tenantId, 'tenant_alpha');
    assert.notEqual(session?.tenantId, 'tenant_beta');
  });
});
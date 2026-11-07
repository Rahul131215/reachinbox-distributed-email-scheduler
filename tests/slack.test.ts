import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SlackService } from '../src/server/slack/slackService';

describe('Slack Notifications & OAuth Validation', () => {
  it('should validate matching Slack OAuth state tokens to prevent CSRF', () => {
    const state = 'slack_csrf_random_nonce_9921';
    assert.equal(SlackService.validateOAuthState(state, state), true);
  });

  it('should reject mismatched Slack OAuth state tokens', () => {
    assert.equal(SlackService.validateOAuthState('state_A', 'state_B'), false);
    assert.equal(SlackService.validateOAuthState('', 'state_B'), false);
  });

  it('should return error when Slack webhook is unconfigured in test environment', async () => {
    delete process.env.SLACK_WEBHOOK_URL;
    const result = await SlackService.sendAlert({
      title: 'Unit Test',
      message: 'Checking missing webhook behavior',
      severity: 'info',
    });
    assert.equal(result.sent, false);
    assert.match(result.error || '', /not configured/);
  });
});

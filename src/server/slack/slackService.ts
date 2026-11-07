export interface SlackNotificationPayload {
  channel?: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'danger' | 'success';
  fields?: Record<string, string | number>;
}

export class SlackService {
  private static webhookUrl = process.env.SLACK_WEBHOOK_URL || '';

  /**
   * Send notification to configured Slack webhook
   */
  public static async sendAlert(payload: SlackNotificationPayload): Promise<{
    sent: boolean;
    error?: string;
  }> {
    const url = this.webhookUrl || process.env.SLACK_WEBHOOK_URL;
    if (!url) {
      return {
        sent: false,
        error: 'SLACK_WEBHOOK_URL is not configured in environment',
      };
    }

    const color =
      payload.severity === 'danger'
        ? '#dc2626'
        : payload.severity === 'warning'
        ? '#f59e0b'
        : payload.severity === 'success'
        ? '#10b981'
        : '#3b82f6';

    const fieldsList = payload.fields
      ? Object.entries(payload.fields).map(([title, value]) => ({
          title,
          value: String(value),
          short: true,
        }))
      : [];

    const body = {
      attachments: [
        {
          color,
          title: `ReachInbox Alert: ${payload.title}`,
          text: payload.message,
          fields: fieldsList,
          footer: 'ReachInbox Distributed Scheduler',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        return { sent: false, error: `Slack returned HTTP ${res.status}: ${text}` };
      }

      return { sent: true };
    } catch (err: any) {
      return { sent: false, error: err?.message || 'Failed to dispatch Slack alert' };
    }
  }

  /**
   * Validate Slack OAuth state parameter to prevent CSRF
   */
  public static validateOAuthState(receivedState: string, expectedState: string): boolean {
    if (!receivedState || !expectedState) return false;
    return receivedState === expectedState;
  }
}

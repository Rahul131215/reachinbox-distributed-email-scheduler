import nodemailer, { Transporter, SentMessageInfo } from 'nodemailer';

export interface EmailDeliveryPayload {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text?: string;
  tenantId: string;
  jobId: string;
  idempotencyKey: string;
}

export interface DeliveryResult {
  success: boolean;
  messageId?: string;
  response?: string;
  accepted?: string[];
  rejected?: string[];
  error?: string;
  timestamp: string;
}

let transporterInstance: Transporter | null = null;

export function getSmtpTransporter(): Transporter {
  if (!transporterInstance) {
    const host = process.env.SMTP_HOST || 'smtp.ethereal.email';
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (user && pass) {
      transporterInstance = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        pool: true,
        maxConnections: 10,
        maxMessages: 100,
      });
    } else {
      // In development or when no external SMTP is configured, use jsonTransport/streamTransport or simulated delivery
      transporterInstance = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true,
      });
    }
  }
  return transporterInstance;
}

export async function verifySmtpConnection(): Promise<{ connected: boolean; error?: string }> {
  try {
    const transporter = getSmtpTransporter();
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      await transporter.verify();
      return { connected: true };
    }
    return {
      connected: false,
      error: 'SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) not configured in environment',
    };
  } catch (err: any) {
    return {
      connected: false,
      error: err?.message || 'SMTP connection failed',
    };
  }
}

export async function deliverEmail(payload: EmailDeliveryPayload): Promise<DeliveryResult> {
  const transporter = getSmtpTransporter();
  const fromAddress = payload.from || process.env.SMTP_FROM || 'noreply@reachinbox.ai';

  const mailOptions = {
    from: fromAddress,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text || payload.html.replace(/<[^>]*>?/gm, ''),
    headers: {
      'X-ReachInbox-Job-ID': payload.jobId,
      'X-ReachInbox-Tenant-ID': payload.tenantId,
      'X-ReachInbox-Idempotency-Key': payload.idempotencyKey,
    },
  };

  try {
    const info: SentMessageInfo = await transporter.sendMail(mailOptions);
    return {
      success: true,
      messageId: info.messageId || `msg_${Date.now()}_${payload.idempotencyKey}`,
      response: typeof info.response === 'string' ? info.response : '250 2.0.0 OK: message queued',
      accepted: Array.isArray(info.accepted) ? info.accepted.map(String) : [payload.to],
      rejected: Array.isArray(info.rejected) ? info.rejected.map(String) : [],
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to send email via SMTP',
      timestamp: new Date().toISOString(),
    };
  }
}

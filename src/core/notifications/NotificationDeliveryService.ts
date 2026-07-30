/**
 * NotificationDeliveryService — Actual email delivery via configured providers.
 *
 * Supports SMTP via nodemailer. Future: SES, SendGrid, M365, etc.
 * Provider credentials are decrypted at send time, never cached.
 */

import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { logger } from '@/lib/logger';

export interface DeliveryPayload {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface DeliveryResult {
  success: boolean;
  messageId?: string;
  smtpResponse?: string;
  error?: string;
  providerName?: string;
}

/**
 * Get the default (or specific) notification provider from DB.
 */
async function getProvider(providerId?: string) {
  if (providerId) {
    return prisma.notification_providers.findUnique({ where: { id: providerId } });
  }
  // Get the default enabled provider
  return prisma.notification_providers.findFirst({
    where: { is_default: true, is_enabled: true },
  });
}

/**
 * Create a nodemailer transport from a provider row.
 */
function createSmtpTransport(provider: {
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_secure: boolean | null;
  smtp_username: string | null;
  smtp_password_enc: string | null;
  timeout_ms: number | null;
}) {
  if (!provider.smtp_host || !provider.smtp_username || !provider.smtp_password_enc) {
    throw new Error('SMTP provider is missing host, username, or password');
  }

  const password = decrypt(provider.smtp_password_enc);

  return nodemailer.createTransport({
    host: provider.smtp_host,
    port: provider.smtp_port ?? 587,
    secure: provider.smtp_secure ?? false,
    auth: {
      user: provider.smtp_username,
      pass: password,
    },
    connectionTimeout: provider.timeout_ms ?? 30000,
    greetingTimeout: 5000,
    socketTimeout: provider.timeout_ms ?? 30000,
    pool: false, // Per-send transport — no connection pooling
  });
}

/**
 * Send an email via the configured notification provider.
 *
 * @param payload - Email content
 * @param providerId - Optional specific provider ID (uses default if omitted)
 */
export async function deliverEmail(
  payload: DeliveryPayload,
  providerId?: string
): Promise<DeliveryResult> {
  try {
    const provider = await getProvider(providerId);

    if (!provider) {
      logger.warn('Delivery', 'No notification provider configured — using env fallback');
      return deliverViaEnvFallback(payload);
    }

    if (!provider.is_enabled) {
      return { success: false, error: `Provider "${provider.name}" is disabled`, providerName: provider.name };
    }

    if (provider.provider_type !== 'smtp') {
      // Future: SES, SendGrid, etc.
      return { success: false, error: `Provider type "${provider.provider_type}" not yet supported`, providerName: provider.name };
    }

    const transport = createSmtpTransport(provider);
    const fromAddress = `"${provider.from_name ?? 'AURIANOA OS'}" <${provider.from_email ?? 'noreply@aurianoa.com'}>`;

    const info = await transport.sendMail({
      from: fromAddress,
      to: payload.to,
      replyTo: payload.replyTo ?? provider.reply_to ?? undefined,
      subject: payload.subject,
      html: payload.html,
      text: payload.text ?? payload.html.replace(/<[^>]*>/g, '').trim(),
      attachments: payload.attachments,
    });

    logger.info('Delivery', `Email sent to ${payload.to}`, {
      messageId: info.messageId,
      provider: provider.name,
    });

    return {
      success: true,
      messageId: info.messageId,
      smtpResponse: info.response,
      providerName: provider.name,
    };
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string };
    logger.error('Delivery', `Email delivery failed to ${payload.to}`, {
      error: err.message,
      code: err.code,
    });
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Fallback: use environment variables for SMTP (pre-M7.6 behavior).
 * Used when no DB provider is configured.
 */
async function deliverViaEnvFallback(payload: DeliveryPayload): Promise<DeliveryResult> {
  try {
    const host = process.env.SMTP_HOST ?? 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT ?? 587);
    const secure = process.env.SMTP_SECURE === 'true';
    const user = process.env.SMTP_USER ?? '';
    const pass = process.env.SMTP_PASS ?? '';

    if (!user || !pass) {
      return { success: false, error: 'No SMTP credentials configured (env or DB)', providerName: 'env-fallback' };
    }

    const transport = nodemailer.createTransport({
      host, port, secure,
      auth: { user, pass },
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 30000,
    });

    const fromName = process.env.EMAIL_FROM_NAME ?? 'AURIANOA OS';
    const fromEmail = process.env.EMAIL_FROM_EMAIL ?? 'noreply@aurianoa.com';

    const info = await transport.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text ?? payload.html.replace(/<[^>]*>/g, '').trim(),
      attachments: payload.attachments,
    });

    return {
      success: true,
      messageId: info.messageId,
      smtpResponse: info.response,
      providerName: 'env-fallback',
    };
  } catch (error: unknown) {
    const err = error as { message?: string };
    return { success: false, error: err.message, providerName: 'env-fallback' };
  }
}

/**
 * Test SMTP connection for a given provider.
 */
export async function testProviderConnection(providerId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const provider = await prisma.notification_providers.findUnique({ where: { id: providerId } });
    if (!provider) return { ok: false, error: 'Provider not found' };
    if (provider.provider_type !== 'smtp') return { ok: false, error: `Test not supported for ${provider.provider_type}` };

    const transport = createSmtpTransport(provider);
    await transport.verify();
    return { ok: true };
  } catch (error: unknown) {
    const err = error as { message?: string };
    return { ok: false, error: err.message };
  }
}

/**
 * Send a test email via a specific provider.
 */
export async function sendTestEmail(
  providerId: string,
  recipientEmail: string
): Promise<DeliveryResult> {
  return deliverEmail(
    {
      to: recipientEmail,
      subject: 'AURIANOA OS — Test Email',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:32px auto;padding:32px;background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.08);">
          <div style="background:#0D2137;padding:20px 24px;border-radius:8px 8px 0 0;">
            <span style="color:#fff;font-size:16px;font-weight:700;letter-spacing:2px;">AURIANOA</span>
            <span style="color:rgba(255,255,255,.4);font-size:10px;margin-left:4px;">OS</span>
          </div>
          <div style="height:3px;background:linear-gradient(90deg,#E8701A,#F59E0B);"></div>
          <div style="padding:24px;">
            <h2 style="margin:0 0 8px;color:#0D2137;font-size:18px;">✅ Email Delivery Test</h2>
            <p style="color:#6B7280;font-size:14px;margin:0 0 16px;">
              This test email confirms that your notification provider is correctly configured.
            </p>
            <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px;">
              <p style="margin:0;color:#374151;font-size:13px;"><strong>Provider ID:</strong> ${providerId}</p>
              <p style="margin:4px 0 0;color:#374151;font-size:13px;"><strong>Sent at:</strong> ${new Date().toISOString()}</p>
            </div>
          </div>
        </div>
      `,
    },
    providerId
  );
}

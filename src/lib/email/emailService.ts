import nodemailer from 'nodemailer';
import { getEmailConfig } from './emailConfig';

export interface SendEmailOptions {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    cc?: string | string[];
    bcc?: string | string[];
    replyTo?: string;
    attachments?: Array<{
        filename: string;
        content: Buffer | string;
        contentType?: string;
    }>;
}

export interface EmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
    provider?: string;
}

let _transport: nodemailer.Transporter | null = null;

function getTransport(): nodemailer.Transporter {
    if (_transport) return _transport;

    const config = getEmailConfig();

    if (config.provider === 'disabled') {
        throw new Error('Email is disabled');
    }

    if (!config.smtp?.user || !config.smtp?.pass) {
        throw new Error(
            'SMTP credentials not configured. Set SMTP_USER and SMTP_PASS in .env'
        );
    }

    _transport = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: {
            user: config.smtp.user,
            pass: config.smtp.pass,
        },
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 30000,
        pool: true,
        maxConnections: 5,
    });

    return _transport;
}

export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
    const config = getEmailConfig();

    if (config.provider === 'disabled') {
        console.log('[Email] DISABLED — would have sent to:', options.to);
        return { success: true, provider: 'disabled (logged)' };
    }

    try {
        const transport = getTransport();

        const info = await transport.sendMail({
            from: `"${config.from_name}" <${config.from_email}>`,
            to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
            cc: options.cc,
            bcc: options.bcc,
            replyTo: options.replyTo,
            subject: options.subject,
            html: options.html,
            text:
                options.text ??
                options.html.replace(/<[^>]*>/g, '').trim(),
            attachments: options.attachments,
        });

        console.log(`[Email] ✅ Sent to ${options.to} — ID: ${info.messageId}`);

        logEmailSent({
            to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
            subject: options.subject,
            message_id: info.messageId,
            status: 'sent',
        }).catch(() => null);

        return {
            success: true,
            messageId: info.messageId,
            provider: 'smtp',
        };
    } catch (error: unknown) {
        const err = error as { message?: string; code?: string };
        console.error('[Email] ❌ Send failed:', {
            to: options.to,
            subject: options.subject,
            error: err.message,
            code: err.code,
        });

        logEmailSent({
            to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
            subject: options.subject,
            status: 'failed',
            error: err.message,
        }).catch(() => null);

        return {
            success: false,
            error: err.message,
            provider: 'smtp',
        };
    }
}

export async function sendEmailWithRetry(
    options: SendEmailOptions,
    maxAttempts = 3
): Promise<EmailResult> {
    let lastResult: EmailResult = { success: false, error: 'Not attempted' };

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        lastResult = await sendEmail(options);

        if (lastResult.success) return lastResult;

        if (attempt < maxAttempts) {
            const delay = attempt * 2000;
            console.log(`[Email] Retry ${attempt}/${maxAttempts} in ${delay}ms`);
            await new Promise((r) => setTimeout(r, delay));
            _transport = null;
        }
    }

    return lastResult;
}

export async function verifyEmailConnection(): Promise<{
    ok: boolean;
    error?: string;
}> {
    const config = getEmailConfig();
    if (config.provider === 'disabled') {
        return { ok: false, error: 'Email is disabled' };
    }
    try {
        const transport = getTransport();
        await transport.verify();
        return { ok: true };
    } catch (e: unknown) {
        const err = e as { message?: string };
        return { ok: false, error: err.message };
    }
}

async function logEmailSent(data: {
    to: string;
    subject: string;
    message_id?: string;
    status: 'sent' | 'failed';
    error?: string;
}) {
    try {
        const { prisma } = await import('@/lib/prisma');
        await (prisma as any).emailLog?.create({
            data: {
                to: data.to,
                subject: data.subject,
                message_id: data.message_id,
                status: data.status,
                error: data.error,
                sent_at: new Date(),
            },
        });
    } catch {
        // Silently fail if table missing
    }
}

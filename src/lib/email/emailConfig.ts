// Email provider configuration
// Supports multiple providers via environment variables

export type EmailProvider = 'smtp' | 'resend' | 'disabled';

export interface EmailConfig {
    provider: EmailProvider;
    from_name: string;
    from_email: string;
    smtp?: {
        host: string;
        port: number;
        secure: boolean;
        user: string;
        pass: string;
    };
    resend?: {
        api_key: string;
    };
}

export function getEmailConfig(): EmailConfig {
    const provider = (process.env.EMAIL_PROVIDER ?? 'smtp') as EmailProvider;

    return {
        provider,
        from_name: process.env.EMAIL_FROM_NAME ?? 'AURIANOA OS',
        from_email: process.env.EMAIL_FROM_EMAIL ?? 'noreply@aurianoa.com',
        smtp: {
            host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
            port: Number(process.env.SMTP_PORT ?? 587),
            secure: process.env.SMTP_SECURE === 'true',
            user: process.env.SMTP_USER ?? '',
            pass: process.env.SMTP_PASS ?? '',
        },
        resend: process.env.RESEND_API_KEY
            ? { api_key: process.env.RESEND_API_KEY }
            : undefined,
    };
}

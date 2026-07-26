import { prisma } from '@/lib/prisma';

export type AiLogData = {
    organization_id: string;
    user_id?: string;
    job_type: string;
    provider?: string;
    model?: string;
    prompt?: string;
    response?: string;
    tokens_input?: number;
    tokens_output?: number;
    latency_ms?: number;
    status: 'success' | 'failed';
    error_message?: string;
};

/**
 * Centralized service to log AI requests to the database.
 */
export async function logAiRequest(data: AiLogData) {
    try {
        await prisma.aiLog.create({
            data: {
                organization_id: data.organization_id,
                user_id: data.user_id,
                job_type: data.job_type,
                provider: data.provider,
                model: data.model,
                prompt: data.prompt,
                response: data.response,
                tokens_input: data.tokens_input,
                tokens_output: data.tokens_output,
                latency_ms: data.latency_ms,
                status: data.status,
                error_message: data.error_message,
            },
        });
    } catch (error) {
        // Silently log to console to prevent AI logging failures from breaking the main flow
        console.error('[AiLoggingService] Failed to create AI log:', error);
    }
}

/**
 * LessonsSuggester
 *
 * Reads the full workpack context (constraints, activities
 * on hold, existing lessons, scope notes) and generates
 * draft lesson entries for planner review.
 *
 * Uses text-only AI (no vision needed).
 * work_type_hint = 'lessons_suggestion'
 *
 * Output: LessonLearned rows with status='draft'
 * Nothing is auto-saved — user must accept each.
 */

import { callVisionAI, parseVisionJson } from './VisionAiService';
import { getPromptTemplate, writeAiLog } from './AiPromptService';

export type SuggestedLesson = {
    title: string;
    description: string;
    recommendation: string;
    category: string;
    impact: 'high' | 'medium' | 'low';
    ai_reasoning: string;
};

export type LessonsSuggestionResult = {
    job_id: string;
    suggestions: SuggestedLesson[];
    context_summary: string;
    input_tokens: number;
    output_tokens: number;
};

async function loadWorkpackContext(workpackId: string): Promise<string> {
    const wp = await prisma.workpack.findFirst({
        where: { id: workpackId },
        select: {
            title: true,
            scope_of_work: true,
            work_type: true,
            planned_start_date: true,
            planned_end_date: true,
            status: true,
            constraint_logs: {
                where: { deleted_at: null },
                select: {
                    title: true,
                    description: true,
                    severity: true,
                    status: true,
                    category: true,
                    resolution_steps: true,
                },
                take: 20,
            },
            activities: {
                where: {
                    deleted_at: null,
                    status: { in: ['on_hold', 'cancelled'] },
                },
                select: {
                    description: true,
                    status: true,
                    notes: true,
                },
                take: 10,
            },
            lessons_learned: {
                where: { deleted_at: null },
                select: {
                    title: true,
                    description: true,
                    category: true,
                    impact: true,
                },
                take: 10,
            },
        },
    });
    if (!wp) throw new Error('Workpack not found');

    const lines: string[] = [
        `WORKPACK: ${wp.title}`,
        `TYPE: ${wp.work_type ?? 'Not specified'}`,
        `SCOPE: ${wp.scope_of_work ?? 'Not provided'}`,
        '',
    ];

    if (wp.constraint_logs.length > 0) {
        lines.push('CONSTRAINTS ENCOUNTERED:');
        wp.constraint_logs.forEach((c, i) => {
            lines.push(
                `${i + 1}. [${(c.severity ?? '').toUpperCase()}] ${c.title}`
            );
            if (c.description) lines.push(`   What happened: ${c.description}`);
            if (c.resolution_steps)
                lines.push(`   Resolution: ${c.resolution_steps}`);
            if (c.status) lines.push(`   Status: ${c.status}`);
        });
        lines.push('');
    }

    if (wp.activities.length > 0) {
        lines.push('ACTIVITIES ON HOLD / CANCELLED:');
        wp.activities.forEach((a) => {
            lines.push(`- ${a.description} (${a.status})`);
            if (a.notes) lines.push(`  Notes: ${a.notes}`);
        });
        lines.push('');
    }

    if (wp.lessons_learned.length > 0) {
        lines.push('EXISTING LESSONS (do not duplicate):');
        wp.lessons_learned.forEach((l) => {
            lines.push(`- ${l.title} [${l.category}]`);
        });
        lines.push('');
    }

    return lines.join('\n');
}


export async function suggestLessons(
    workpackId: string,
    organizationId: string,
    requestedBy: string
): Promise<LessonsSuggestionResult> {
    const job = await prisma.aiExtractionJob.create({
        data: {
            organization_id: organizationId,
            workpack_id: workpackId,
            requested_by: requestedBy,
            status: 'processing',
            work_type_hint: 'lessons_suggestion',
            started_at: new Date(),
        },
    });

    try {
        const context = await loadWorkpackContext(workpackId);
        const template = await getPromptTemplate(organizationId, 'lessons_suggestion');
        const prompt = template.replace('{{context}}', context);

        const aiConfig = await prisma.aiProviderSetting.findUnique({
            where: { organization_id: organizationId }
        });
        const provider = aiConfig?.provider || 'openai';
        const startedAt = Date.now();
 
        let rawContent: string;
        try {
            rawContent = await callVisionAI({
                orgId: organizationId,
                workpackId,
                userPrompt: prompt,
                systemPrompt: 'Maintenance engineer. Return JSON only.',
                context: { workpackId }
            });
        } catch (err: any) {
            await writeAiLog({
                organization_id: organizationId,
                job_type: 'lessons_suggestion',
                prompt: prompt.substring(0, 1000),
                latency_ms: Date.now() - startedAt,
                status: 'failed',
                error_message: err.message || String(err),
            });
            throw err;
        }

        type RawLessons = {
            lessons?: SuggestedLesson[];
            context_summary?: string;
        };

        const parsed = parseVisionJson(rawContent) as RawLessons;

        const suggestions = (parsed.lessons ?? [])
            .slice(0, 6)
            .map((l) => ({
                title: (l.title ?? '').slice(0, 200),
                description: l.description ?? '',
                recommendation: l.recommendation ?? '',
                category: l.category ?? 'what_went_wrong',
                impact: (l.impact ?? 'medium') as 'high' | 'medium' | 'low',
                ai_reasoning: l.ai_reasoning ?? '',
            }));

        await prisma.aiExtractionResult.create({
            data: {
                organization_id: organizationId,
                ai_extraction_job_id: job.id,
                raw_ai_response: rawContent,
                extracted_data_json: {
                    suggestions,
                    context_summary: parsed.context_summary ?? '',
                } as object,
                review_status: 'pending_review',
                overall_confidence: 0.8,
            },
        });

        await prisma.aiExtractionJob.update({
            where: { id: job.id },
            data: {
                status: 'completed',
                completed_at: new Date(),
            },
        });

        await writeAiLog({
            organization_id: organizationId,
            job_type: 'lessons_suggestion',
            prompt: prompt.substring(0, 1000),
            response: rawContent,
            latency_ms: Date.now() - startedAt,
            status: 'success',
        });

        return {
            job_id: job.id,
            suggestions,
            context_summary: parsed.context_summary ?? '',
            input_tokens: 0,
            output_tokens: 0,
        };
    } catch (e: unknown) {
        await prisma.aiExtractionJob.update({
            where: { id: job.id },
            data: {
                status: 'failed',
                completed_at: new Date(),
                error_message: e instanceof Error ? e.message : String(e),
            },
        });
        throw e;
    }
}

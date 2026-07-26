/**
 * DocumentParameterExtractor
 *
 * Builds extraction prompts, sends pages to Vision AI,
 * parses structured results, maps to DB field paths,
 * detects conflicts with existing values.
 *
 * job_type = 'document_parameter_extraction'
 * stored in AiExtractionJob.work_type_hint
 */

import { prisma } from '@/lib/prisma';
import {
    callVisionAi,
    parseVisionJson,
    type VisionImage,
} from './VisionAiService';
import { getPromptTemplate, writeAiLog } from './AiPromptService';
import { renderPagesAsImages, extractPageRange } from './PdfProcessor';
import { join } from 'path';
import { randomUUID } from 'crypto';

// ── Parameter categories ──────────────────────────

export type ParameterCategory =
    | 'hydrotest'
    | 'torque'
    | 'cleaning'
    | 'preparation';

export type PageRangeInput = {
    label: string;
    from: number;
    to: number;
};

export type ExtractionConfig = {
    workpack_id: string;
    organization_id: string;
    source_document_id: string;
    source_storage_path: string;
    page_ranges: PageRangeInput[];
    parameters: ParameterCategory[];
    custom_instruction?: string;
    requested_by: string;
};

// ── Extracted parameter shape ─────────────────────

export type ExtractedParameter = {
    key: string;
    label: string;
    value: string | number | null;
    unit: string | null;
    source_text: string | null;
    page_number: number | null;
    confidence: 'high' | 'medium' | 'low';
    calculated: boolean;
    calculation_basis: string | null;
    ambiguous: boolean;
    candidates: Array<{
        value: string | number;
        context: string;
        page_number: number | null;
    }>;
    field_path: string;
    field_section: ParameterCategory;
};

export type ExtractionResult = {
    job_id: string;
    parameters: ExtractedParameter[];
    document_summary: string;
    equipment_identified: string[];
    warnings_found: string[];
    input_tokens: number;
    output_tokens: number;
};

// ── Parameter definitions ─────────────────────────

type ParamDef = {
    key: string;
    label: string;
    unit?: string | null;
    field_path: string;
    patterns: string[];
};

const PARAMETER_DEFS: Record<ParameterCategory, ParamDef[]> = {
    hydrotest: [
        {
            key: 'design_pressure_bar',
            label: 'Design Pressure / MAWP',
            unit: 'barg',
            field_path: 'certificates.hydrotest_shell.design_pressure_bar',
            patterns: [
                'design pressure',
                'MAWP',
                'maximum allowable working pressure',
                'rated pressure',
            ],
        },
        {
            key: 'test_pressure_bar',
            label: 'Hydrotest Pressure',
            unit: 'barg',
            field_path: 'certificates.hydrotest_shell.test_pressure_bar',
            patterns: [
                'hydrostatic test pressure',
                'test pressure',
                'hydrotest pressure',
                'hydraulic test',
            ],
        },
        {
            key: 'test_duration_mins',
            label: 'Hold Duration',
            unit: 'minutes',
            field_path: 'certificates.hydrotest_shell.test_duration_mins',
            patterns: [
                'hold time',
                'test duration',
                'minimum hold',
                'soak time',
            ],
        },
        {
            key: 'test_medium',
            label: 'Test Medium',
            unit: null,
            field_path: 'certificates.hydrotest_shell.test_medium',
            patterns: [
                'test medium',
                'test fluid',
                'testing medium',
                'test liquid',
            ],
        },
        {
            key: 'tube_test_pressure_bar',
            label: 'Tube Side Test Pressure',
            unit: 'barg',
            field_path: 'certificates.hydrotest_tube.tube_test_pressure_bar',
            patterns: [
                'tube side test',
                'tube side pressure',
                'tube bundle test',
            ],
        },
    ],
    torque: [
        {
            key: 'torque_stage_1_nm',
            label: 'Stage 1 / Initial Torque',
            unit: 'N·m',
            field_path: 'certificates.torque.torque_stage_1_nm',
            patterns: [
                'stage 1',
                'first pass',
                'snug tight',
                'initial torque',
                'pass 1',
            ],
        },
        {
            key: 'torque_stage_2_nm',
            label: 'Stage 2 / Intermediate Torque',
            unit: 'N·m',
            field_path: 'certificates.torque.torque_stage_2_nm',
            patterns: [
                'stage 2',
                'second pass',
                'intermediate',
                'pass 2',
                'cross torque',
            ],
        },
        {
            key: 'torque_final_nm',
            label: 'Final / Target Torque',
            unit: 'N·m',
            field_path: 'certificates.torque.torque_final_nm',
            patterns: [
                'final torque',
                'target torque',
                'full torque',
                'stage 3',
                'pass 3',
                'maximum torque',
                'rated torque',
            ],
        },
        {
            key: 'bolt_size_grade',
            label: 'Bolt Size & Grade',
            unit: null,
            field_path: 'certificates.torque.bolt_size_grade',
            patterns: [
                'bolt size',
                'stud size',
                'bolt grade',
                'A193',
                'B7',
                'B8',
                'bolt specification',
            ],
        },
        {
            key: 'gasket_spec',
            label: 'Gasket Specification',
            unit: null,
            field_path: 'certificates.boxup.gasket_spec',
            patterns: [
                'gasket',
                'spiral wound',
                'CAF',
                'ring joint',
                'RTJ',
                'gasket type',
            ],
        },
    ],
    cleaning: [
        {
            key: 'cleaning_method',
            label: 'Cleaning Method',
            unit: null,
            field_path: 'cleaning_instructions.cleaning_method',
            patterns: [
                'cleaning method',
                'clean with',
                'flushing medium',
                'DM water',
                'steam clean',
                'chemical flush',
            ],
        },
        {
            key: 'acceptance_criteria',
            label: 'Cleanliness Acceptance Criteria',
            unit: null,
            field_path: 'cleaning_instructions.acceptance_criteria',
            patterns: [
                'acceptance criteria',
                'cleanliness standard',
                'clean to',
                'NAS',
                'ISO 4406',
                'particle count',
            ],
        },
        {
            key: 'cleaning_standard',
            label: 'Cleaning Standard Reference',
            unit: null,
            field_path: 'cleaning_instructions.cleaning_standard',
            patterns: [
                'per standard',
                'to standard',
                'procedure number',
                'SP-CLEAN',
            ],
        },
        {
            key: 'flush_duration_mins',
            label: 'Flush Duration',
            unit: 'minutes',
            field_path: 'cleaning_instructions.flush_duration_mins',
            patterns: [
                'flush time',
                'minimum flush',
                'circulation time',
                'flush duration',
            ],
        },
    ],
    preparation: [
        {
            key: 'special_tools',
            label: 'Special Tools Required',
            unit: null,
            field_path: 'preparation.special_tools',
            patterns: [
                'special tools',
                'tools required',
                'equipment required',
                'tooling list',
            ],
        },
        {
            key: 'bundle_weight_kg',
            label: 'Bundle / Equipment Weight',
            unit: 'kg',
            field_path: 'preparation.bundle_weight_kg',
            patterns: [
                'bundle weight',
                'equipment weight',
                'lift weight',
                'shell weight',
            ],
        },
        {
            key: 'crane_capacity_t',
            label: 'Crane Capacity Required',
            unit: 'tonnes',
            field_path: 'preparation.crane_capacity_t',
            patterns: [
                'crane capacity',
                'crane size',
                'lifting capacity',
                'SWL',
            ],
        },
        {
            key: 'critical_clearances',
            label: 'Critical Clearances / Tolerances',
            unit: 'mm',
            field_path: 'preparation.critical_clearances',
            patterns: [
                'clearance',
                'tolerance',
                'alignment',
                'gap',
                'run-out',
            ],
        },
    ],
};

// ── Build extraction prompt ─────────────────────

function buildExtractionPrompt(
    template: string,
    categories: ParameterCategory[],
    siteStandard: {
        pressure_test_standard: string;
        hydrotest_multiplier: number;
        torque_standard: string;
    },
    customInstruction?: string
): string {
    const paramList = categories
        .flatMap((cat) => PARAMETER_DEFS[cat])
        .map(
            (p) =>
                `  - ${p.key} (${p.label}${p.unit ? ', ' + p.unit : ''}): look for ${p.patterns.slice(0, 3).join(', ')}`
        )
        .join('\n');

    return template
        .replace('{{pressure_test_standard}}', siteStandard.pressure_test_standard)
        .replace(/{{hydrotest_multiplier}}/g, String(siteStandard.hydrotest_multiplier))
        .replace('{{torque_standard}}', siteStandard.torque_standard)
        .replace('{{parameters_list}}', paramList)
        .replace('{{custom_instruction}}', customInstruction ? `USER INSTRUCTION:\n${customInstruction}\n\n` : '');
}

// ── Main extraction function ──────────────────────

export async function runDocumentExtraction(
    config: ExtractionConfig
): Promise<ExtractionResult> {
    const workpack = await prisma.workpack.findFirst({
        where: { id: config.workpack_id },
        select: { site_id: true },
    });
    if (!workpack) throw new Error('Workpack not found');

    const site = await prisma.site.findFirst({
        where: { id: workpack.site_id },
        select: {
            pressure_test_standard: true,
            hydrotest_multiplier: true,
            torque_standard: true,
        },
    });
    const siteStandard = site ?? {
        pressure_test_standard: 'ASME_VIII',
        hydrotest_multiplier: 1.5,
        torque_standard: 'ASME_PCC_1',
    };

    const job = await prisma.aiExtractionJob.create({
        data: {
            organization_id: config.organization_id,
            site_id: workpack.site_id,
            workpack_id: config.workpack_id,
            requested_by: config.requested_by,
            status: 'processing',
            work_type_hint: 'document_parameter_extraction',
            additional_instructions: config.custom_instruction ?? null,
            started_at: new Date(),
        },
    });

    try {
        const allPageNumbers = new Set<number>();
        for (const range of config.page_ranges) {
            for (let p = range.from; p <= range.to; p++) {
                allPageNumbers.add(p);
            }
        }

        const pageNumbers = [...allPageNumbers]
            .sort((a, b) => a - b)
            .slice(0, 20);

        const renderedPages = await renderPagesAsImages(
            config.source_storage_path,
            pageNumbers,
            2.0
        );

        const images: VisionImage[] = renderedPages.map((p) => ({
            base64: p.image_base64,
            mimeType: 'image/png',
        }));

        const template = await getPromptTemplate(config.organization_id, 'document_parameter_extraction');
        const prompt = buildExtractionPrompt(
            template,
            config.parameters,
            {
                pressure_test_standard: siteStandard.pressure_test_standard,
                hydrotest_multiplier: siteStandard.hydrotest_multiplier,
                torque_standard: siteStandard.torque_standard,
            },
            config.custom_instruction
        );

        const startedAt = Date.now();
        let visionResult;
        try {
            visionResult = await callVisionAi({
                organization_id: config.organization_id,
                prompt,
                images,
                max_tokens: 4096,
                temperature: 0.1,
            });
        } catch (err: any) {
            await writeAiLog({
                organization_id: config.organization_id,
                user_id: config.requested_by,
                job_type: 'document_parameter_extraction',
                prompt,
                latency_ms: Date.now() - startedAt,
                status: 'failed',
                error_message: err.message || String(err),
            });
            throw err;
        }

        type RawResult = {
            parameters?: Record<
                string,
                {
                    value?: string | number | null;
                    unit?: string | null;
                    source_text?: string | null;
                    page_number?: number | null;
                    confidence?: 'high' | 'medium' | 'low';
                    calculated?: boolean;
                    calculation_basis?: string | null;
                    ambiguous?: boolean;
                    candidates?: Array<{
                        value: string | number;
                        context: string;
                        page_number: number | null;
                    }>;
                }
            >;
            document_summary?: string;
            equipment_identified?: string[];
            warnings_found?: string[];
        };

        const raw = parseVisionJson<RawResult>(visionResult.content);

        const allDefs = config.parameters.flatMap(
            (cat) => PARAMETER_DEFS[cat]
        );

        const parameters: ExtractedParameter[] = allDefs
            .map((def) => {
                const r = raw.parameters?.[def.key];
                const section = (config.parameters.find((cat) =>
                    PARAMETER_DEFS[cat].some((d) => d.key === def.key)
                ) ?? 'hydrotest') as ParameterCategory;
                return {
                    key: def.key,
                    label: def.label,
                    value: r?.value ?? null,
                    unit: r?.unit ?? def.unit ?? null,
                    source_text: r?.source_text ?? null,
                    page_number: r?.page_number ?? null,
                    confidence: r?.confidence ?? 'low',
                    calculated: r?.calculated ?? false,
                    calculation_basis: r?.calculation_basis ?? null,
                    ambiguous: r?.ambiguous ?? false,
                    candidates: r?.candidates ?? [],
                    field_path: def.field_path,
                    field_section: section,
                };
            })
            .filter((p) => p.value !== null);

        await prisma.aiExtractionResult.create({
            data: {
                organization_id: config.organization_id,
                ai_extraction_job_id: job.id,
                raw_ai_response: visionResult.content,
                extracted_data_json: {
                    parameters,
                    document_summary: raw.document_summary,
                    equipment_identified: raw.equipment_identified,
                    warnings_found: raw.warnings_found,
                    page_ranges: config.page_ranges,
                    source_document_id: config.source_document_id,
                } as object,
                review_status: 'pending_review',
                overall_confidence:
                    parameters.length > 0
                        ? parameters.filter((p) => p.confidence === 'high')
                              .length / parameters.length
                        : 0,
            },
        });

        await prisma.aiExtractionJob.update({
            where: { id: job.id },
            data: {
                status: 'completed',
                completed_at: new Date(),
                provider_used: visionResult.provider_used,
                model_used: visionResult.model_used,
                input_tokens: visionResult.input_tokens,
                output_tokens: visionResult.output_tokens,
                processing_seconds: Math.floor(
                    (Date.now() - (job.started_at?.getTime() ?? 0)) / 1000
                ),
            },
        });

        await writeAiLog({
            organization_id: config.organization_id,
            user_id: config.requested_by,
            job_type: 'document_parameter_extraction',
            provider: visionResult.provider_used,
            model: visionResult.model_used,
            prompt,
            response: visionResult.content,
            tokens_input: visionResult.input_tokens,
            tokens_output: visionResult.output_tokens,
            latency_ms: Date.now() - startedAt,
            status: 'success',
        });

        for (const range of config.page_ranges) {
            try {
                const subUuid = randomUUID();
                const subFilename = `${subUuid}.pdf`;
                const subDir = join(
                    process.cwd(),
                    'uploads',
                    'workpacks',
                    config.workpack_id
                );
                const subPath = join(subDir, subFilename);

                await extractPageRange(
                    config.source_storage_path,
                    range.from,
                    range.to,
                    subPath
                );

                const sourceDoc = await prisma.workpackDocument.findFirst({
                    where: { id: config.source_document_id },
                    select: { site_id: true, workpack_id: true },
                });
                if (sourceDoc) {
                    await prisma.workpackDocument.create({
                        data: {
                            organization_id: config.organization_id,
                            site_id: sourceDoc.site_id,
                            workpack_id: config.workpack_id,
                            document_type: 'spec',
                            original_filename: subFilename,
                            storage_path: `uploads/workpacks/${config.workpack_id}/${subFilename}`,
                            mime_type: 'application/pdf',
                            title: range.label,
                            description: `Extracted pages ${range.from}–${range.to} from source document`,
                            include_in_pdf: false,
                            source: 'ai_extract',
                            source_document_id: config.source_document_id,
                            source_pages: Array.from(
                                { length: range.to - range.from + 1 },
                                (_, i) => range.from + i
                            ),
                            extraction_job_id: job.id,
                            created_by: config.requested_by,
                        },
                    });
                }
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                console.error(
                    `[Extraction] Sub-PDF extract failed for range "${range.label}":`,
                    msg
                );
            }
        }

        return {
            job_id: job.id,
            parameters,
            document_summary: raw.document_summary ?? '',
            equipment_identified: raw.equipment_identified ?? [],
            warnings_found: raw.warnings_found ?? [],
            input_tokens: visionResult.input_tokens,
            output_tokens: visionResult.output_tokens,
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

/**
 * IssueClassificationService — AI discipline classification + failure mode detection.
 * M7.2 — Engineering Scope Intelligence.
 */

import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';
import { callSyorityAI, SyorityAiConfig } from '@/lib/ai/universalAiClient';
import { parseVisionJson } from '@/services/ai/VisionAiService';
import { loadProviderForJob } from '@/services/ai/ProviderLoader';

// ── Types ──────────────────────────────────────────

export const DISCIPLINES = [
  'Mechanical',
  'Inspection',
  'Electrical',
  'Instrumentation',
  'Operations',
  'Civil',
  'Reliability',
  'Safety',
  'Environment',
] as const;

export type Discipline = typeof DISCIPLINES[number];

export type ClassificationResult = {
  issue_id: string;
  primary_discipline: string;
  confidence: number;
  failure_mode: string | null;
  category: string | null;
  template_hint: string | null;
  all_classifications: Array<{ discipline: string; confidence: number }>;
};

// ── AI Prompt ──────────────────────────────────────

const CLASSIFICATION_PROMPT = `
You are classifying engineering issues from an industrial plant into disciplines.

DISCIPLINES:
- Mechanical: pumps, compressors, turbines, gearboxes, bearings, seals, couplings, alignment
- Inspection: corrosion, erosion, wall thickness, NDE, coating, insulation condition, CUI
- Electrical: motors, cables, switchgear, transformers, lighting, earthing, power supply
- Instrumentation: transmitters, control valves, DCS, ESD, fire & gas, analysers, gauges
- Operations: process optimization, procedures, operating limits, alarms, trip settings
- Civil: foundations, structures, buildings, pipe racks, drainage, fireproofing
- Reliability: failure analysis, RCA, reliability studies, spare parts, maintenance strategy
- Safety: safety valves, fire protection, emergency systems, PPE, safe work procedures
- Environment: emissions, effluent, noise, waste management, environmental compliance

FAILURE MODES (common):
- Leakage, Corrosion, Erosion, Vibration, Overheating, Fouling, Blockage
- Wear, Fatigue, Cracking, Misalignment, Cavitation, Seizure, Electrical_Fault
- Instrument_Drift, Control_Loop_Issue, Trip_Failure, Coating_Degradation

For each issue, classify ALL applicable disciplines with confidence scores, identify the failure mode, and suggest a category.

Return ONLY valid JSON:
{
  "classifications": [
    {
      "issue_index": number,
      "primary_discipline": string,
      "disciplines": [{ "discipline": string, "confidence": number }],
      "failure_mode": string | null,
      "category": string | null,
      "template_hint": string | null
    }
  ]
}
`;

// ── Service ────────────────────────────────────────

export class IssueClassificationService {
  /**
   * Classify a single issue.
   */
  static async classifySingleIssue(
    organizationId: string,
    issueId: string
  ): Promise<ClassificationResult> {
    const issue = await prisma.engineeringIssue.findFirst({
      where: { id: issueId, organization_id: organizationId, deleted_at: null },
    });
    if (!issue) throw new Error('Issue not found');

    const provider = await loadProviderForJob(organizationId);
    const config: SyorityAiConfig = {
      provider: provider.provider,
      model: provider.model,
      apiKey: provider.apiKey,
      maxTokens: 2048,
      temperature: 0.1,
    };

    const issueText = `Tag: ${issue.equipment_tag_raw || 'Unknown'}\nProblem: ${issue.problem}\nRecommendation: ${issue.recommendation || 'None'}\nDepartment: ${issue.department || 'Unknown'}`;
    const prompt = `${CLASSIFICATION_PROMPT}\n\n--- ISSUES ---\nIssue 0:\n${issueText}`;
    const result = await callSyorityAI(config, prompt);
    const parsed = parseVisionJson<{
      classifications: Array<{
        issue_index: number;
        primary_discipline: string;
        disciplines: Array<{ discipline: string; confidence: number }>;
        failure_mode: string | null;
        category: string | null;
        template_hint: string | null;
      }>;
    }>(result.content);

    const classification = parsed.classifications?.[0];
    if (!classification) throw new Error('AI classification returned no results');

    // Store classifications
    await prisma.issueClassification.deleteMany({ where: { issue_id: issueId } });
    for (const disc of classification.disciplines || []) {
      await prisma.issueClassification.create({
        data: {
          id: randomUUID(),
          issue_id: issueId,
          discipline: disc.discipline,
          confidence: disc.confidence,
          failure_mode: classification.failure_mode,
          category: classification.category,
          template_hint: classification.template_hint,
          ai_model_used: provider.model,
        },
      });
    }

    // Update issue with primary classification
    await prisma.engineeringIssue.update({
      where: { id: issueId },
      data: {
        ai_discipline: classification.primary_discipline,
        ai_discipline_confidence: classification.disciplines?.[0]?.confidence ?? null,
        ai_failure_mode: classification.failure_mode,
        ai_category: classification.category,
        ai_template_hint: classification.template_hint,
        discipline: classification.primary_discipline,
      },
    });

    await prisma.issueAuditLog.create({
      data: {
        id: randomUUID(),
        issue_id: issueId,
        action: 'classify',
        new_value: `${classification.primary_discipline} (${Math.round((classification.disciplines?.[0]?.confidence ?? 0) * 100)}%)`,
        notes: classification.failure_mode ? `Failure mode: ${classification.failure_mode}` : null,
      },
    });

    return {
      issue_id: issueId,
      primary_discipline: classification.primary_discipline,
      confidence: classification.disciplines?.[0]?.confidence ?? 0,
      failure_mode: classification.failure_mode,
      category: classification.category,
      template_hint: classification.template_hint,
      all_classifications: classification.disciplines || [],
    };
  }

  /**
   * Batch classify multiple issues.
   */
  static async classifyBatch(
    organizationId: string,
    batchId?: string,
    limit: number = 50
  ) {
    const where: any = {
      organization_id: organizationId,
      deleted_at: null,
      ai_discipline: null,
      problem: { not: '' },
    };
    if (batchId) where.batch_id = batchId;

    const issues = await prisma.engineeringIssue.findMany({
      where,
      select: { id: true, equipment_tag_raw: true, problem: true, recommendation: true, department: true },
      take: limit,
    });

    if (issues.length === 0) return { classified: 0, errors: 0 };

    const provider = await loadProviderForJob(organizationId);
    const config: SyorityAiConfig = {
      provider: provider.provider,
      model: provider.model,
      apiKey: provider.apiKey,
      maxTokens: 8192,
      temperature: 0.1,
    };

    // Build batch prompt (up to 20 at a time for token budget)
    const chunks = [];
    for (let i = 0; i < issues.length; i += 20) {
      chunks.push(issues.slice(i, i + 20));
    }

    let classified = 0;
    let errors = 0;

    for (const chunk of chunks) {
      try {
        const issueTexts = chunk.map((issue, idx) =>
          `Issue ${idx}:\nTag: ${issue.equipment_tag_raw || 'Unknown'}\nProblem: ${issue.problem}\nRecommendation: ${issue.recommendation || 'None'}\nDepartment: ${issue.department || 'Unknown'}`
        ).join('\n\n');

        const prompt = `${CLASSIFICATION_PROMPT}\n\n--- ISSUES ---\n${issueTexts}`;
        const result = await callSyorityAI(config, prompt);
        const parsed = parseVisionJson<{
          classifications: Array<{
            issue_index: number;
            primary_discipline: string;
            disciplines: Array<{ discipline: string; confidence: number }>;
            failure_mode: string | null;
            category: string | null;
            template_hint: string | null;
          }>;
        }>(result.content);

        for (const cls of parsed.classifications || []) {
          const issue = chunk[cls.issue_index];
          if (!issue) continue;

          try {
            // Store per-discipline classifications
            for (const disc of cls.disciplines || []) {
              await prisma.issueClassification.create({
                data: {
                  id: randomUUID(),
                  issue_id: issue.id,
                  discipline: disc.discipline,
                  confidence: disc.confidence,
                  failure_mode: cls.failure_mode,
                  category: cls.category,
                  template_hint: cls.template_hint,
                  ai_model_used: provider.model,
                },
              });
            }

            // Update issue
            await prisma.engineeringIssue.update({
              where: { id: issue.id },
              data: {
                ai_discipline: cls.primary_discipline,
                ai_discipline_confidence: cls.disciplines?.[0]?.confidence ?? null,
                ai_failure_mode: cls.failure_mode,
                ai_category: cls.category,
                ai_template_hint: cls.template_hint,
                discipline: cls.primary_discipline,
              },
            });

            classified++;
          } catch {
            errors++;
          }
        }
      } catch {
        errors += chunk.length;
      }
    }

    return { classified, errors };
  }
}

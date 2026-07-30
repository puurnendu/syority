/**
 * M7.6B — AI Report Assistant
 *
 * Consumes ProviderRegistry only — never duplicate queries.
 * Generates AI summaries, risk analysis, and recommended actions.
 * Graceful degradation when AI is not configured.
 */

import { providerRegistry, type ProviderContext } from './providers';
import type { DataFetcherResult } from './data-fetchers';

// ─── Analysis Types ─────────────────────────────────────────────────────────

export type AnalysisType =
  | 'executive_summary'
  | 'top_risks'
  | 'delay_analysis'
  | 'critical_equipment'
  | 'tomorrows_priorities'
  | 'recommended_actions';

// ─── Service ────────────────────────────────────────────────────────────────

export class AiReportAssistant {
  /**
   * Analyze report data using AI.
   * Data is fetched from the ProviderRegistry — no duplicate queries.
   */
  static async analyze(opts: {
    dataSourceKey: string;
    ctx: ProviderContext;
    params: Record<string, any>;
    analysisType?: AnalysisType;
    customPromptTemplate?: string | null;
    reportName?: string;
  }): Promise<string> {
    try {
      // 1. Fetch data from provider
      const data = await providerRegistry.fetch(opts.dataSourceKey, opts.ctx, opts.params);

      // 2. Build prompt
      const prompt = opts.customPromptTemplate
        ? AiReportAssistant.resolvePromptTemplate(opts.customPromptTemplate, data, opts)
        : AiReportAssistant.buildPrompt(data, opts.analysisType ?? 'executive_summary', opts.reportName);

      // 3. Invoke AI
      return await AiReportAssistant.invokeAi(prompt);
    } catch (err: any) {
      console.warn('[AiReportAssistant] Analysis failed:', err.message);
      return '<em>AI analysis unavailable — generation failed.</em>';
    }
  }

  /**
   * Analyze pre-fetched data (when data is already available from generation).
   */
  static async analyzeData(opts: {
    data: DataFetcherResult;
    analysisType?: AnalysisType;
    customPromptTemplate?: string | null;
    reportName?: string;
  }): Promise<string> {
    try {
      const prompt = opts.customPromptTemplate
        ? AiReportAssistant.resolvePromptTemplate(opts.customPromptTemplate, opts.data, opts)
        : AiReportAssistant.buildPrompt(opts.data, opts.analysisType ?? 'executive_summary', opts.reportName);

      return await AiReportAssistant.invokeAi(prompt);
    } catch (err: any) {
      console.warn('[AiReportAssistant] Analysis failed:', err.message);
      return '<em>AI analysis unavailable — generation failed.</em>';
    }
  }

  // ── Prompt Building ───────────────────────────────────────────────────

  private static buildPrompt(data: DataFetcherResult, type: AnalysisType, reportName?: string): string {
    const dataContext = AiReportAssistant.summarizeData(data);
    const instructions = ANALYSIS_INSTRUCTIONS[type];

    return `You are a senior industrial project analyst reviewing a report titled "${reportName ?? 'Project Report'}".

Here is the report data:
${dataContext}

${instructions}

Keep your response under 300 words. Use bullet points for clarity. Be specific — reference actual data values.`;
  }

  private static resolvePromptTemplate(
    template: string,
    data: DataFetcherResult,
    opts: { reportName?: string }
  ): string {
    const dataContext = AiReportAssistant.summarizeData(data);
    return template
      .replace('{{data}}', dataContext)
      .replace('{{reportName}}', opts.reportName ?? 'Report')
      .replace('{{rowCount}}', String(data.rows?.length ?? 0))
      .replace('{{kpis}}', JSON.stringify(data.kpis ?? []));
  }

  private static summarizeData(data: DataFetcherResult): string {
    const parts: string[] = [];

    if (data.summary) parts.push(`Summary: ${data.summary}`);

    if (data.kpis?.length) {
      parts.push('KPIs:');
      data.kpis.forEach((k) => parts.push(`  - ${k.label}: ${k.value}${k.unit ? ` ${k.unit}` : ''}`));
    }

    if (data.rows?.length) {
      parts.push(`\nData rows (${data.rows.length} records):`);
      // Include first 20 rows as sample
      const sample = data.rows.slice(0, 20);
      if (sample.length > 0) {
        const cols = Object.keys(sample[0]);
        parts.push(cols.join(' | '));
        sample.forEach((row) => parts.push(cols.map((c) => String(row[c] ?? '—')).join(' | ')));
        if (data.rows.length > 20) parts.push(`... and ${data.rows.length - 20} more rows.`);
      }
    }

    return parts.join('\n');
  }

  // ── AI Invocation ─────────────────────────────────────────────────────

  private static async invokeAi(prompt: string): Promise<string> {
    // Dynamic import — graceful failure if AI not configured
    const { generateText } = await import('@/lib/ai/textGeneration').catch(() => ({
      generateText: null,
    }));

    if (!generateText) {
      return '<em>AI summary unavailable — text generation service not configured.</em>';
    }

    const result = await (generateText as Function)(prompt);
    return typeof result === 'string'
      ? result.replace(/\n/g, '<br/>')
      : '<em>AI summary generation failed.</em>';
  }
}

// ─── Analysis Instructions ──────────────────────────────────────────────────

const ANALYSIS_INSTRUCTIONS: Record<AnalysisType, string> = {
  executive_summary: `Provide a concise executive summary covering:
1. Key highlights and achievements
2. Top risks and concerns
3. Critical delays or issues
4. Recommended actions
5. Tomorrow's priorities`,

  top_risks: `Identify the top 5 risks based on the data:
1. What is the risk?
2. What is the current impact?
3. What is the likelihood if unaddressed?
4. What mitigation is recommended?`,

  delay_analysis: `Analyze all delays in the data:
1. Which activities or workpacks are delayed?
2. What is the root cause pattern?
3. What is the schedule impact?
4. What recovery actions are recommended?`,

  critical_equipment: `Identify critical equipment concerns:
1. Which equipment is at risk?
2. What maintenance or inspection is overdue?
3. What is the production impact?
4. What immediate actions are needed?`,

  tomorrows_priorities: `Based on the current data, list tomorrow's top priorities:
1. What must start?
2. What must complete?
3. What blockers must be resolved?
4. What resources need to be mobilized?`,

  recommended_actions: `Based on the report data, provide actionable recommendations:
1. Immediate actions (next 24 hours)
2. Short-term actions (this week)
3. Medium-term improvements (this month)
4. Resource or process changes needed`,
};

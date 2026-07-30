/**
 * Text Generation Helper
 *
 * Simple wrapper around the Universal AI Client for plain text generation.
 * Used by ReportGenerationService and AiReportAssistant via dynamic import.
 */

import { callSyorityAI } from './universalAiClient';
import { getDefaultProviderConfig } from './defaultProvider';

/**
 * Generate text from a prompt using the default AI provider.
 * Returns the generated text string.
 * Throws if no AI provider is configured.
 */
export async function generateText(prompt: string, systemPrompt?: string): Promise<string> {
  const config = getDefaultProviderConfig();

  const result = await callSyorityAI(
    {
      modelIdentifier: config.model,
      apiKey: config.apiKey,
      provider: config.provider,
    },
    prompt,
    systemPrompt
  );

  return result.content;
}

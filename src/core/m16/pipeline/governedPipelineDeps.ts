/**
 * Shared PipelineDependencies for LIVE conversational channels.
 *
 * Used by the served WhatsApp webhook and Voice route so they cannot
 * drift into stub entity resolvers or no-op audit loggers.
 *
 * llmCaller matches IntentClassifier: (systemPrompt, userPrompt) => string
 * and callTextAi: (ProviderConfig, prompt, ...).
 */
import { callTextAi, loadProviderForJob, type JobType } from '@/services/ai/ProviderLoader';
import { resolveEntityChain } from '../entity/M16EntityResolver';
import { logInteraction } from '../audit/M16InteractionAuditService';
import type { PipelineDependencies } from './M16InteractionPipeline';
import type { M16Channel, M16InteractionContext } from '../types';
import type { M16Intent, M16IntentCategory } from '../intents';

export function createGovernedPipelineDependencies(params: {
  organizationId: string;
  userId: string;
  channel: M16Channel;
  jobType: JobType;
}): PipelineDependencies {
  return {
    llmCaller: async (systemPrompt: string, userPrompt: string) => {
      const config = await loadProviderForJob(params.organizationId, params.jobType);
      const combined = `${systemPrompt}\n\n${userPrompt}`;
      const result = await callTextAi(config, combined, 2048, 0.1, {
        organizationId: params.organizationId,
        userId: params.userId,
        jobType: params.jobType,
      });
      return result.content;
    },
    resolveEntities: async (organizationId, eventId, hints) => {
      const ctx: M16InteractionContext = {
        organizationId,
        eventId,
        userId: params.userId,
        channel: params.channel,
        conversationId: '',
        identitySource: params.channel === 'whatsapp' ? 'phone_number' : 'session_cookie',
        siteId: null,
        messageId: null,
      };
      return resolveEntityChain(
        ctx,
        hints.equipmentTag ?? undefined,
        hints.activityDescription ?? undefined,
      );
    },
    logInteraction: async (entry) => {
      await logInteraction({
        ctx: {
          organizationId: entry.organizationId,
          userId: entry.userId,
          channel: entry.channel as M16Channel,
          conversationId: entry.conversationId,
          eventId: entry.eventId,
          identitySource: params.channel === 'whatsapp' ? 'phone_number' : 'session_cookie',
          siteId: null,
          messageId: null,
        },
        intent: (entry.intent as M16Intent) || null,
        intentCategory: null as M16IntentCategory | null,
        rawMessage: entry.userMessage,
        resolvedEntities: null,
        riskLevel: null,
        authorization: 'not_required',
        deniedReason: null,
        confirmation: null,
        result: 'success',
        resultDetail: entry.responseText,
      });
    },
  };
}

/**
 * M7.6D — Safety Intelligence Providers
 *
 * 20 safety-specific providers consuming SafetyService.
 * All providers use the existing SafetyService — zero raw Prisma.
 */

import { BaseProvider, type ProviderContext } from './BaseProvider';
import type { DataFetcherResult } from '../data-fetchers';
import { SafetyService } from '@/core/safety/SafetyService';
const safeSafety: any = SafetyService;

// ─── Helpers ────────────────────────────────────────────────────────────────

function getEventId(p: Record<string, any>): string { return p.event ?? p.eventId ?? p.event_id ?? ''; }

// ─── Providers ──────────────────────────────────────────────────────────────

class PermitStatusProvider extends BaseProvider {
  readonly key = 'safety.permit_status'; readonly category = 'safety'; readonly name = 'Permit to Work Status';
  readonly description = 'PTW issued, active, closed, suspended counts.'; readonly requiredParams = ['event'];
  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const data = await safeSafety.getPermitStatus(getEventId(params));
    return { kpis: data.kpis ?? [], rows: data.rows ?? [] };
  }
}

class GasTestProvider extends BaseProvider {
  readonly key = 'safety.gas_test'; readonly category = 'safety'; readonly name = 'Gas Test Results';
  readonly description = 'Gas testing records and compliance.'; readonly requiredParams = ['event'];
  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const data = await safeSafety.getGasTests(getEventId(params));
    return { kpis: data.kpis ?? [], rows: data.rows ?? [] };
  }
}

class ConfinedSpaceProvider extends BaseProvider {
  readonly key = 'safety.confined_space'; readonly category = 'safety'; readonly name = 'Confined Space Entries';
  readonly description = 'Active confined space permits and entries.'; readonly requiredParams = ['event'];
  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const data = await safeSafety.getConfinedSpaceEntries(getEventId(params));
    return { kpis: data.kpis ?? [], rows: data.rows ?? [] };
  }
}

class HotWorkProvider extends BaseProvider {
  readonly key = 'safety.hot_work'; readonly category = 'safety'; readonly name = 'Hot Work Permits';
  readonly description = 'Hot work permit status and compliance.'; readonly requiredParams = ['event'];
  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const data = await safeSafety.getHotWorkPermits(getEventId(params));
    return { kpis: data.kpis ?? [], rows: data.rows ?? [] };
  }
}

class WorkAtHeightProvider extends BaseProvider {
  readonly key = 'safety.work_at_height'; readonly category = 'safety'; readonly name = 'Work at Height';
  readonly description = 'Work at height permits and incidents.'; readonly requiredParams = ['event'];
  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const data = await safeSafety.getWorkAtHeight(getEventId(params));
    return { kpis: data.kpis ?? [], rows: data.rows ?? [] };
  }
}

class LiftingProvider extends BaseProvider {
  readonly key = 'safety.lifting'; readonly category = 'safety'; readonly name = 'Lifting Operations';
  readonly description = 'Crane lifts and lifting plan compliance.'; readonly requiredParams = ['event'];
  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const data = await safeSafety.getLiftingOperations(getEventId(params));
    return { kpis: data.kpis ?? [], rows: data.rows ?? [] };
  }
}

class ExcavationProvider extends BaseProvider {
  readonly key = 'safety.excavation'; readonly category = 'safety'; readonly name = 'Excavation Permits';
  readonly description = 'Excavation permit tracking.'; readonly requiredParams = ['event'];
  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const data = await safeSafety.getExcavationPermits(getEventId(params));
    return { kpis: data.kpis ?? [], rows: data.rows ?? [] };
  }
}

class PPEComplianceProvider extends BaseProvider {
  readonly key = 'safety.ppe_compliance'; readonly category = 'safety'; readonly name = 'PPE Compliance';
  readonly description = 'PPE compliance observations.'; readonly requiredParams = ['event'];
  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const data = await safeSafety.getPPECompliance(getEventId(params));
    return { kpis: data.kpis ?? [], rows: data.rows ?? [] };
  }
}

class EmergencyEquipmentProvider extends BaseProvider {
  readonly key = 'safety.emergency_equipment'; readonly category = 'safety'; readonly name = 'Emergency Equipment';
  readonly description = 'Emergency equipment inspection status.'; readonly requiredParams = ['event'];
  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const data = await safeSafety.getEmergencyEquipment(getEventId(params));
    return { kpis: data.kpis ?? [], rows: data.rows ?? [] };
  }
}

class FireEquipmentProvider extends BaseProvider {
  readonly key = 'safety.fire_equipment'; readonly category = 'safety'; readonly name = 'Fire Equipment';
  readonly description = 'Fire extinguisher and equipment status.'; readonly requiredParams = ['event'];
  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const data = await safeSafety.getFireEquipment(getEventId(params));
    return { kpis: data.kpis ?? [], rows: data.rows ?? [] };
  }
}

class ToolboxTalksProvider extends BaseProvider {
  readonly key = 'safety.toolbox_talks'; readonly category = 'safety'; readonly name = 'Toolbox Talks';
  readonly description = 'Toolbox talk completion and attendance.'; readonly requiredParams = ['event'];
  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const data = await safeSafety.getToolboxTalks(getEventId(params));
    return { kpis: data.kpis ?? [], rows: data.rows ?? [] };
  }
}

class SafetyObservationsProvider extends BaseProvider {
  readonly key = 'safety.safety_observations'; readonly category = 'safety'; readonly name = 'Safety Observations';
  readonly description = 'Field safety observations.'; readonly requiredParams = ['event'];
  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const data = await safeSafety.getSafetyObservations(getEventId(params));
    return { kpis: data.kpis ?? [], rows: data.rows ?? [] };
  }
}

class CorrectiveActionsProvider extends BaseProvider {
  readonly key = 'safety.corrective_actions'; readonly category = 'safety'; readonly name = 'Corrective Actions';
  readonly description = 'Open and overdue corrective actions.'; readonly requiredParams = ['event'];
  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const data = await safeSafety.getCorrectiveActions(getEventId(params));
    return { kpis: data.kpis ?? [], rows: data.rows ?? [] };
  }
}

class ContractorSafetyScoreProvider extends BaseProvider {
  readonly key = 'safety.contractor_safety_score'; readonly category = 'safety'; readonly name = 'Contractor Safety Score';
  readonly description = 'Safety score per contractor.'; readonly requiredParams = ['event'];
  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const data = await safeSafety.getContractorSafetyScores(getEventId(params));
    return { kpis: data.kpis ?? [], rows: data.rows ?? [] };
  }
}

class SafetyHeatmapProvider extends BaseProvider {
  readonly key = 'safety.safety_heatmap'; readonly category = 'safety'; readonly name = 'Safety Heatmap';
  readonly description = 'Incident density by area/unit.'; readonly requiredParams = ['event'];
  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const data = await safeSafety.getSafetyHeatmap(getEventId(params));
    return { rows: data.rows ?? [] };
  }
}

class UnsafeActsProvider extends BaseProvider {
  readonly key = 'safety.unsafe_acts'; readonly category = 'safety'; readonly name = 'Unsafe Acts';
  readonly description = 'Reported unsafe acts.'; readonly requiredParams = ['event'];
  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const data = await safeSafety.getUnsafeActs(getEventId(params));
    return { kpis: data.kpis ?? [], rows: data.rows ?? [] };
  }
}

class UnsafeConditionsProvider extends BaseProvider {
  readonly key = 'safety.unsafe_conditions'; readonly category = 'safety'; readonly name = 'Unsafe Conditions';
  readonly description = 'Reported unsafe conditions.'; readonly requiredParams = ['event'];
  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const data = await safeSafety.getUnsafeConditions(getEventId(params));
    return { kpis: data.kpis ?? [], rows: data.rows ?? [] };
  }
}

class NearMissDetailProvider extends BaseProvider {
  readonly key = 'safety.near_miss_detail'; readonly category = 'safety'; readonly name = 'Near Miss Detail';
  readonly description = 'Detailed near miss register.'; readonly requiredParams = ['event'];
  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const data = await safeSafety.getNearMissDetail(getEventId(params));
    return { kpis: data.kpis ?? [], rows: data.rows ?? [] };
  }
}

class LTIDetailProvider extends BaseProvider {
  readonly key = 'safety.lti_detail'; readonly category = 'safety'; readonly name = 'LTI Detail';
  readonly description = 'Lost Time Injury detail register.'; readonly requiredParams = ['event'];
  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const data = await safeSafety.getLTIDetail(getEventId(params));
    return { kpis: data.kpis ?? [], rows: data.rows ?? [] };
  }
}

class AISafetySummaryProvider extends BaseProvider {
  readonly key = 'safety.ai_safety_summary'; readonly category = 'safety'; readonly name = 'AI Safety Summary';
  readonly description = 'Structured AI-generated safety summary.'; readonly requiredParams = ['event'];
  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const kpiData = await safeSafety.getKPISummary(getEventId(params));
    const summary = `Safety Summary: ${kpiData.kpis?.map((k: any) => `${k.label}: ${k.value}`).join(', ') ?? 'No data available.'}`;
    return { summary, kpis: kpiData.kpis ?? [] };
  }
}

// ─── Export All ──────────────────────────────────────────────────────────────

export const safetyIntelligenceProviders = [
  new PermitStatusProvider(), new GasTestProvider(), new ConfinedSpaceProvider(),
  new HotWorkProvider(), new WorkAtHeightProvider(), new LiftingProvider(),
  new ExcavationProvider(), new PPEComplianceProvider(), new EmergencyEquipmentProvider(),
  new FireEquipmentProvider(), new ToolboxTalksProvider(), new SafetyObservationsProvider(),
  new CorrectiveActionsProvider(), new ContractorSafetyScoreProvider(), new SafetyHeatmapProvider(),
  new UnsafeActsProvider(), new UnsafeConditionsProvider(), new NearMissDetailProvider(),
  new LTIDetailProvider(), new AISafetySummaryProvider(),
];

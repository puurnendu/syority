import { prisma } from '@/lib/prisma';

/**
 * Readiness Score Engine — computes workpack readiness as % of 12 weighted criteria.
 */
export class ReadinessScoreService {
  private static readonly CRITERIA = [
    { key: 'template_selected',    weight: 8,  label: 'Template Selected' },
    { key: 'activities_generated', weight: 10, label: 'Activities Generated' },
    { key: 'documents_attached',   weight: 8,  label: 'Documents Attached' },
    { key: 'resources_assigned',   weight: 10, label: 'Resources Assigned' },
    { key: 'materials_available',  weight: 10, label: 'Materials Available' },
    { key: 'qa_package',           weight: 8,  label: 'QA Package' },
    { key: 'certificates',         weight: 8,  label: 'Certificates' },
    { key: 'permits',              weight: 8,  label: 'Permits' },
    { key: 'isolation_plan',       weight: 8,  label: 'Isolation Plan' },
    { key: 'execution_calendar',   weight: 8,  label: 'Execution Calendar' },
    { key: 'crew_assigned',        weight: 7,  label: 'Crew Assigned' },
    { key: 'approval',             weight: 7,  label: 'Approval' },
  ] as const;

  /** Compute readiness for a single workpack */
  static async computeReadiness(workpackId: string): Promise<{
    score: number;
    detail: Record<string, { passed: boolean; weight: number; label: string }>;
  }> {
    const wp = await prisma.workpack.findUnique({
      where: { id: workpackId },
      include: {
        activities:          { where: { deleted_at: null }, select: { id: true } },
        workpack_documents:  { where: { deleted_at: null }, select: { id: true } },
        workpack_materials:  { where: { deleted_at: null }, select: { id: true, status: true } },
        certificateInstances:{ select: { id: true } },
        form_instances:      { where: { deleted_at: null }, select: { id: true } },
        blinds:              { where: { deleted_at: null }, select: { id: true } },
      },
    });
    if (!wp) throw new Error('Workpack not found');

    // Count resources across all activities
    const resourceCount = await prisma.activityResource.count({
      where: { workpack_id: workpackId },
    });

    // Resources with crew
    const crewCount = await prisma.activityResource.count({
      where: { workpack_id: workpackId, headcount: { gt: 0 } },
    });

    // QA records
    const qaCount = await prisma.qa_clearance_records.count({
      where: { workpack_id: workpackId },
    });

    const checks: Record<string, boolean> = {
      template_selected:    !!wp.template_id,
      activities_generated: wp.activities.length > 0,
      documents_attached:   wp.workpack_documents.length > 0,
      resources_assigned:   resourceCount > 0,
      materials_available:  wp.workpack_materials.length === 0 || wp.workpack_materials.some(m => m.status !== 'pending'),
      qa_package:           qaCount > 0 || wp.form_instances.length > 0,
      certificates:         wp.certificateInstances.length > 0,
      permits:              wp.form_instances.length > 0 || wp.certificateInstances.some(c => c),
      isolation_plan:       wp.blinds.length > 0,
      execution_calendar:   !!wp.planned_start_date && !!wp.planned_end_date,
      crew_assigned:        crewCount > 0,
      approval:             wp.approval_status === 'approved',
    };

    let totalWeight = 0;
    let earnedWeight = 0;
    const detail: Record<string, { passed: boolean; weight: number; label: string }> = {};

    for (const c of this.CRITERIA) {
      const passed = checks[c.key] || false;
      detail[c.key] = { passed, weight: c.weight, label: c.label };
      totalWeight += c.weight;
      if (passed) earnedWeight += c.weight;
    }

    const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;

    // Update cached score on workpack
    await prisma.workpack.update({
      where: { id: workpackId },
      data: { readiness_score: score },
    });

    return { score, detail };
  }

  /** Batch compute readiness for all workpacks in a scope */
  static async batchComputeReadiness(scopeId: string): Promise<Array<{
    workpackId: string;
    workpackNumber: string | null;
    title: string;
    score: number;
  }>> {
    const instantiations = await prisma.workpackInstantiation.findMany({
      where: { scope_id: scopeId },
      select: { workpack_id: true },
    });

    const results = [];
    for (const inst of instantiations) {
      try {
        const { score } = await this.computeReadiness(inst.workpack_id);
        const wp = await prisma.workpack.findUnique({
          where: { id: inst.workpack_id },
          select: { workpack_number: true, title: true },
        });
        results.push({
          workpackId: inst.workpack_id,
          workpackNumber: wp?.workpack_number || null,
          title: wp?.title || '',
          score,
        });
      } catch {
        // Skip errors
      }
    }

    return results;
  }
}

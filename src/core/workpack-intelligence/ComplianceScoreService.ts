import { prisma } from '@/lib/prisma';

export type DeviationSeverity = 'critical' | 'minor';
export type Deviation = {
  category: string;
  description: string;
  severity: DeviationSeverity;
};

/**
 * Compliance Score Engine — compares an instantiated workpack against its originating template.
 */
export class ComplianceScoreService {
  /** Compute compliance score for a workpack */
  static async computeCompliance(workpackId: string): Promise<{
    score: number;
    critical: Deviation[];
    minor: Deviation[];
    totalDeviations: number;
  }> {
    const wp = await prisma.workpack.findUnique({
      where: { id: workpackId },
      select: {
        id: true,
        template_id: true,
        equipment_technical_data: true,
        activities: {
          where: { deleted_at: null },
          select: { id: true, description: true, activity_number: true },
        },
        workpack_materials: {
          where: { deleted_at: null },
          select: { id: true, description: true, material_number: true },
        },
        certificateInstances: {
          select: { id: true, cert_type: true, cert_name: true },
        },
      },
    });
    if (!wp) throw new Error('Workpack not found');
    if (!wp.template_id) {
      // No template = 100% compliance (nothing to compare against)
      return { score: 100, critical: [], minor: [], totalDeviations: 0 };
    }

    // Get template data
    const templateActivities = await prisma.workpack_template_activities.findMany({
      where: { template_id: wp.template_id },
      select: { description: true, activity_code: true, sequence_number: true },
    });

    const techData = wp.equipment_technical_data as any;
    const templateMaterials = techData?.materials || [];
    const templateQaqc = techData?.qaqc || {};
    const templateSafety = techData?.safety || {};
    const templateResources = techData?.resources || [];
    const templateCertTypes: string[] = templateQaqc?.certificate_types || templateQaqc?.certificates || [];

    const critical: Deviation[] = [];
    const minor: Deviation[] = [];

    // ── Activities ────────────────────────────────────────────────────────
    const templateDescSet = new Set(templateActivities.map(a => a.description.toLowerCase().trim()));
    const actualDescSet = new Set(wp.activities.map(a => a.description.toLowerCase().trim()));

    // Activities removed from template
    for (const ta of templateActivities) {
      if (!actualDescSet.has(ta.description.toLowerCase().trim())) {
        critical.push({
          category: 'Activities Removed',
          description: `Template activity "${ta.description}" was removed`,
          severity: 'critical',
        });
      }
    }

    // Activities added (not in template)
    for (const act of wp.activities) {
      if (!templateDescSet.has(act.description.toLowerCase().trim())) {
        minor.push({
          category: 'Activities Added',
          description: `Activity "${act.description}" not in original template`,
          severity: 'minor',
        });
      }
    }

    // ── Certificates ──────────────────────────────────────────────────────
    const actualCertTypes = new Set(wp.certificateInstances.map(c => c.cert_type));
    for (const ct of templateCertTypes) {
      if (!actualCertTypes.has(ct)) {
        critical.push({
          category: 'Certificates Removed',
          description: `Required certificate type "${ct}" is missing`,
          severity: 'critical',
        });
      }
    }

    // ── QA Checks ─────────────────────────────────────────────────────────
    const templateQaChecks: string[] = templateQaqc?.qa_checks || [];
    if (templateQaChecks.length > 0 && wp.certificateInstances.length === 0) {
      critical.push({
        category: 'QA Removed',
        description: 'Template requires QA checks but no QA/certificate instances exist',
        severity: 'critical',
      });
    }

    // ── Safety Requirements ───────────────────────────────────────────────
    const templatePermits: string[] = templateSafety?.permits || [];
    const templateIsolation = templateSafety?.isolation_required;
    if (templatePermits.length > 0) {
      // Check if forms/certs cover permit types (simplified check)
      minor.push({
        category: 'Safety Requirements',
        description: `Template specifies ${templatePermits.length} permit type(s) — verify coverage`,
        severity: 'minor',
      });
    }

    // ── Materials ─────────────────────────────────────────────────────────
    if (Array.isArray(templateMaterials) && templateMaterials.length > 0) {
      const templateMatDescs = new Set(templateMaterials.map((m: any) => (m.description || '').toLowerCase().trim()));
      const actualMatDescs = new Set(wp.workpack_materials.map(m => m.description.toLowerCase().trim()));

      for (const tm of templateMaterials) {
        const desc = (tm.description || '').toLowerCase().trim();
        if (desc && !actualMatDescs.has(desc)) {
          minor.push({
            category: 'Materials Changed',
            description: `Template material "${tm.description}" not found in workpack`,
            severity: 'minor',
          });
        }
      }
    }

    // ── Resources ─────────────────────────────────────────────────────────
    if (Array.isArray(templateResources) && templateResources.length > 0) {
      const actualResourceCount = await prisma.activityResource.count({ where: { workpack_id: workpackId } });
      if (actualResourceCount < templateResources.length) {
        minor.push({
          category: 'Resources Changed',
          description: `Template specifies ${templateResources.length} resource(s) but only ${actualResourceCount} assigned`,
          severity: 'minor',
        });
      }
    }

    // ── Compute Score ─────────────────────────────────────────────────────
    const totalDeviations = critical.length + minor.length;
    // Each critical deviation = -10%, each minor = -3%, floor at 0
    const penalty = (critical.length * 10) + (minor.length * 3);
    const score = Math.max(0, 100 - penalty);

    // Cache on workpack
    await prisma.workpack.update({
      where: { id: workpackId },
      data: { compliance_score: score },
    });

    return { score, critical, minor, totalDeviations };
  }

  /** List deviations for a workpack */
  static async listDeviations(workpackId: string): Promise<Deviation[]> {
    const result = await this.computeCompliance(workpackId);
    return [...result.critical, ...result.minor];
  }
}

import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';

export type PermitReadinessRecord = {
  permit_number: string;
  status: string;
  valid_until: Date | null;
  workpack_id: string | null;
  activity_id: string | null;
};

export class PermitService {
  /**
   * Same issued/expiry rules used by single-activity and bulk readiness.
   * Does not change permit issuance; evaluation only.
   */
  static evaluatePermitRecords(
    permits: PermitReadinessRecord[],
    now: Date = new Date()
  ): string[] {
    const blockers: string[] = [];
    for (const permit of permits) {
      if (permit.status !== 'issued') {
        blockers.push(`Permit ${permit.permit_number} is in status '${permit.status}' (requires 'issued').`);
      } else if (permit.valid_until && permit.valid_until < now) {
        blockers.push(`Permit ${permit.permit_number} has expired on ${permit.valid_until.toISOString()}.`);
      }
    }
    return blockers;
  }

  /**
   * Evaluates if all required permits for a workpack or activity are valid.
   */
  static async validatePermitsForExecution(orgId: string, workpackId: string, activityId?: string): Promise<{ isValid: boolean; blockers: string[] }> {
    const whereClause: any = {
      organization_id: orgId,
      OR: [{ workpack_id: workpackId }]
    };
    if (activityId) {
      whereClause.OR.push({ activity_id: activityId });
    }

    const permits = await prisma.permit.findMany({
      where: whereClause,
      select: {
        permit_number: true,
        status: true,
        valid_until: true,
        workpack_id: true,
        activity_id: true,
      },
    });

    const blockers = this.evaluatePermitRecords(permits);
    return {
      isValid: blockers.length === 0,
      blockers
    };
  }

  static async issuePermit(orgId: string, permitId: string, userId: string, validUntil: Date): Promise<any> {
    const permit = await prisma.permit.findFirst({ where: { id: permitId, organization_id: orgId } });
    if (!permit) throw new Error('Permit not found');
    
    if (permit.status === 'issued') {
      throw new Error('Permit is already issued');
    }

    const updated = await prisma.permit.update({
      where: { id: permitId },
      data: {
        status: 'issued',
        issued_by: userId,
        issued_at: new Date(),
        valid_until: validUntil,
        updated_at: new Date()
      }
    });

    await AuditService.log({
      organization_id: orgId,
      user_id: userId,
      action: 'updated',
      model_name: 'Permit',
      model_id: permitId,
      new_values: { status: 'issued', valid_until: validUntil }
    });

    return updated;
  }
}

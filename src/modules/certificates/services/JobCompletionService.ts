import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';

type ValidationResult = {
    isValid: boolean;
    incompleteActivities: number;
    openCatA: number;
    pendingSignOffs: number;
    totalPunchB: number;
    totalPunchC: number;
};

export class JobCompletionService {
    /**
     * Validates that a workpack meets all prerequisites for JCC issuance.
     * Checks: all activities completed, no Cat A punch, all clearance sign-offs done.
     */
    static async validateCompletion(workpackId: string, _orgId: string): Promise<ValidationResult> {
        const [incompleteActivities, openCatA, totalPunchB, totalPunchC] = await Promise.all([
            prisma.activity.count({ where: { workpack_id: workpackId, NOT: { status: 'completed' } } }),
            prisma.punchListItem.count({ where: { workpack_id: workpackId, category: 'A', NOT: { status: 'closed' } } }),
            prisma.punchListItem.count({ where: { workpack_id: workpackId, category: 'B', NOT: { status: 'closed' } } }),
            prisma.punchListItem.count({ where: { workpack_id: workpackId, category: 'C', NOT: { status: 'closed' } } }),
        ]);

        // ClearanceForBoxup has no @relation to ClearanceSignOff — use separate query
        const clearance = await prisma.clearanceForBoxup.findUnique({ where: { workpack_id: workpackId } });
        let pendingSignOffs = 0;
        if (clearance) {
            pendingSignOffs = await prisma.clearanceSignOff.count({
                where: { clearance_id: clearance.id, signed_at: null },
            });
        }

        return {
            isValid: incompleteActivities === 0 && openCatA === 0 && pendingSignOffs === 0,
            incompleteActivities,
            openCatA,
            pendingSignOffs,
            totalPunchB,
            totalPunchC,
        };
    }

    static async getCertificate(workpackId: string, _orgId: string) {
        return prisma.jobCompletionCertificate.findUnique({ where: { workpack_id: workpackId } });
    }

    static async createCertificate(workpackId: string, orgId: string, userId: string) {
        const validation = await this.validateCompletion(workpackId, orgId);
        if (!validation.isValid) {
            const reasons: string[] = [];
            if (validation.incompleteActivities > 0) reasons.push(`${validation.incompleteActivities} incomplete activities`);
            if (validation.openCatA > 0) reasons.push(`${validation.openCatA} open Cat A punch items`);
            if (validation.pendingSignOffs > 0) reasons.push(`${validation.pendingSignOffs} pending clearance sign-offs`);
            throw new Error(`Cannot create JCC: ${reasons.join(', ')}`);
        }

        const workpack = await prisma.workpack.findUnique({ where: { id: workpackId }, select: { workpack_number: true } });

        const cert = await prisma.jobCompletionCertificate.create({
            data: {
                organization_id: orgId,
                workpack_id: workpackId,
                created_by: userId,
                certificate_number: `JCC-${workpack?.workpack_number ?? workpackId.slice(0, 8).toUpperCase()}`,
                open_punch_cat_b: validation.totalPunchB,
                open_punch_cat_c: validation.totalPunchC,
                activities_completed: await prisma.activity.count({ where: { workpack_id: workpackId, status: 'completed' } }),
            },
        });

        await AuditService.log({
            organization_id: orgId,
            user_id: userId,
            action: 'created',
            model_name: 'JobCompletionCertificate',
            model_id: cert.id,
            new_values: { certificate_number: cert.certificate_number, workpack_id: workpackId },
        });

        return cert;
    }

    static async updateCertificate(workpackId: string, orgId: string, userId: string, data: {
        scope_summary?: string | null;
        pressure_tests_status?: string | null;
        materials_summary?: string | null;
        lessons_learnt_summary?: string | null;
        client_name?: string | null;
    }) {
        const cert = await prisma.jobCompletionCertificate.findUnique({ where: { workpack_id: workpackId } });
        if (!cert || cert.organization_id !== orgId) throw new Error('Not found');

        const updated = await prisma.jobCompletionCertificate.update({
            where: { id: cert.id },
            data: {
                ...(data.scope_summary !== undefined ? { scope_summary: data.scope_summary } : {}),
                ...(data.pressure_tests_status !== undefined ? { pressure_tests_status: data.pressure_tests_status } : {}),
                ...(data.materials_summary !== undefined ? { materials_summary: data.materials_summary } : {}),
                ...(data.lessons_learnt_summary !== undefined ? { lessons_learnt_summary: data.lessons_learnt_summary } : {}),
                ...(data.client_name !== undefined ? { client_name: data.client_name } : {}),
            },
        });

        await AuditService.log({ organization_id: orgId, user_id: userId, action: 'updated', model_name: 'JobCompletionCertificate', model_id: cert.id, new_values: data as Record<string, unknown> });
        return updated;
    }

    /**
     * Records a role-based sign-off on the JCC.
     * role: 'maint_engineer' | 'operations' | 'qa' | 'client'
     */
    static async signCertificate(workpackId: string, orgId: string, userId: string, role: 'maint_engineer' | 'operations' | 'qa' | 'client') {
        const cert = await prisma.jobCompletionCertificate.findUnique({ where: { workpack_id: workpackId } });
        if (!cert || cert.organization_id !== orgId) throw new Error('JCC not found');

        const fieldMap: Record<string, { idField: string; atField: string }> = {
            maint_engineer: { idField: 'maint_engineer_id', atField: 'maint_engineer_signed_at' },
            operations:     { idField: 'operations_id',     atField: 'operations_signed_at' },
            qa:             { idField: 'qa_id',              atField: 'qa_signed_at' },
            client:         { idField: 'client_name',        atField: 'client_signed_at' },
        };

        const { idField, atField } = fieldMap[role];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: Record<string, any> = {
            [idField]: userId,
            [atField]: new Date(),
        };

        const updated = await prisma.jobCompletionCertificate.update({ where: { id: cert.id }, data: updateData });
        await AuditService.log({ organization_id: orgId, user_id: userId, action: 'updated', model_name: 'JobCompletionCertificate', model_id: cert.id, new_values: { role, signed_at: new Date().toISOString() } });
        return updated;
    }
}

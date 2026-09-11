import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';

async function fetchClearanceWithSignOffs(workpackId: string) {
    const clearance = await prisma.clearance_for_boxup.findUnique({ where: { workpack_id: workpackId } });
    if (!clearance) return null;
    const sign_offs = await prisma.clearance_sign_offs.findMany({
        where: { clearance_id: clearance.id },
        orderBy: { created_at: 'asc' },
    });
    return { ...clearance, sign_offs };
}

export class ClearanceService {
    static async getClearance(workpackId: string, _orgId: string) {
        return fetchClearanceWithSignOffs(workpackId);
    }

    static async initializeClearance(workpackId: string, orgId: string, userId: string) {
        // Get org clearance parties
        const parties = await prisma.org_clearance_parties.findMany({
            where: { organization_id: orgId, is_active: true },
            orderBy: { sequence_number: 'asc' },
        });

        // Create clearance record
        const clearance = await prisma.clearance_for_boxup.create({
            data: { organization_id: orgId, workpack_id: workpackId, created_by: userId },
        });

        // Create sign-off rows for each party
        if (parties.length > 0) {
            await prisma.clearance_sign_offs.createMany({
                data: parties.map((p) => ({
                    organization_id: orgId,
                    clearance_id: clearance.id,
                    party_name: p.party_name,
                    condition: p.condition,
                })),
            });
        }

        await AuditService.log({
            organization_id: orgId,
            user_id: userId,
            action: 'created',
            model_name: 'ClearanceForBoxup',
            model_id: clearance.id,
            new_values: { workpackId },
        });

        return fetchClearanceWithSignOffs(workpackId);
    }

    static async signOff(signOffId: string, orgId: string, userId: string, notes?: string) {
        const signOff = await prisma.clearance_sign_offs.update({
            where: { id: signOffId, organization_id: orgId },
            data: { signed_by: userId, signed_at: new Date(), notes },
        });

        await AuditService.log({
            organization_id: orgId,
            user_id: userId,
            action: 'updated',
            model_name: 'ClearanceSignOff',
            model_id: signOffId,
            new_values: { notes },
        });

        return signOff;
    }
}

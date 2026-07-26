import { prisma } from '@/lib/prisma';

export class CertificateService {
    static async getFlangeBoxupData(workpackId: string, orgId: string) {
        const joints = await prisma.jointIntegrityItem.findMany({
            where: { workpack_id: workpackId, organization_id: orgId, status: 'signed_off' },
            orderBy: { joint_number: 'asc' },
        });

        const workpack = await prisma.workpack.findUnique({
            where: { id: workpackId },
            include: { unit: true },
        });

        return { workpack, joints, generated_at: new Date(), cert_type: 'FLANGE_BOXUP' };
    }

    static async getTorqueData(workpackId: string, orgId: string) {
        const joints = await prisma.jointIntegrityItem.findMany({
            where: { workpack_id: workpackId, organization_id: orgId, torque_witness_name: { not: null } },
            orderBy: { joint_number: 'asc' },
        });

        return { joints, generated_at: new Date(), cert_type: 'TORQUE_WITNESS' };
    }

    static async getHydrotestData(workpackId: string, orgId: string) {
        // QaClearanceRecord has no @relation to Organization — fetch activities and clearances separately
        const activities = await prisma.activity.findMany({
            where: {
                workpack_id: workpackId,
                organization_id: orgId,
                OR: [
                    { description: { contains: 'Hydrotest', mode: 'insensitive' } },
                    { activity_number: { contains: 'HYD', mode: 'insensitive' } },
                ],
                status: 'completed',
            },
        });

        const activityIds = activities.map((a) => a.id);
        const clearances = activityIds.length > 0
            ? await prisma.qaClearanceRecord.findMany({ where: { activity_id: { in: activityIds } } })
            : [];

        const activitiesWithClearances = activities.map((a) => ({
            ...a,
            qa_clearances: clearances.filter((c) => c.activity_id === a.id),
        }));

        return { activities: activitiesWithClearances, generated_at: new Date(), cert_type: 'HYDROTEST' };
    }
}

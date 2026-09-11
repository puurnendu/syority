import { prisma } from '@/lib/prisma';
import { CleaningMethod } from '@prisma/client';

type CreateCleaningInput = {
    workpack_id: string;
    cleaning_method: CleaningMethod;
    certificate_number?: string | null;
    cleaning_medium?: string | null;
    before_condition?: string | null;
    after_condition?: string | null;
    notes?: string | null;
};

export class CleaningService {
    static async getRecords(workpackId: string, orgId: string) {
        return prisma.cleaning_records.findMany({
            where: { workpack_id: workpackId, organization_id: orgId },
            orderBy: { created_at: 'desc' }
        });
    }

    static async createRecord(data: CreateCleaningInput, orgId: string, userId: string) {
        return prisma.cleaning_records.create({
            data: {
                organization_id: orgId,
                created_by: userId,
                workpack_id: data.workpack_id,
                cleaning_method: data.cleaning_method,
                certificate_number: data.certificate_number ?? null,
                cleaning_medium: data.cleaning_medium ?? null,
                before_condition: data.before_condition ?? null,
                after_condition: data.after_condition ?? null,
                notes: data.notes ?? null,
            }
        });
    }

    static async signOff(recordId: string, orgId: string, userId: string, acceptance: boolean) {
        return prisma.cleaning_records.update({
            where: { id: recordId, organization_id: orgId },
            data: {
                inspector_acceptance: acceptance,
                inspector_id: userId,
                inspected_at: new Date()
            }
        });
    }
}

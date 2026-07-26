import { prisma } from '@/lib/prisma';

export class LessonsLearntService {
    static async getLessons(workpackId: string, orgId: string) {
        return prisma.lessonsLearnt.findMany({
            where: { workpack_id: workpackId, organization_id: orgId },
            orderBy: { created_at: 'desc' }
        });
    }

    static async createLesson(data: any, orgId: string, userId: string) {
        return prisma.lessonsLearnt.create({
            data: {
                ...data,
                organization_id: orgId,
                created_by: userId
            }
        });
    }

    static async deleteLesson(lessonId: string, orgId: string) {
        return prisma.lessonsLearnt.delete({
            where: { id: lessonId, organization_id: orgId }
        });
    }
}

import { NextResponse } from 'next/server';
import { guardPlatformApi } from '@/security/apiGuards';
import { prisma } from '@/lib/prisma';

/**
 * One-time backfill: set activity_number on activities that don't have one.
 * Format: {TAG}_{SEQ} e.g. E435_001. Call GET once to fix existing workpacks.
 */
export async function GET() {
    const { session, error } = await guardPlatformApi('nav.admin');
    if (error) return error;

    const workpacks = await prisma.workpack.findMany({
        where: { deleted_at: null },
        include: {
            activities: {
                where: { deleted_at: null },
                orderBy: { sequence_number: 'asc' },
                select: { id: true, activity_number: true, sequence_number: true },
            },
        },
    });

    let updated = 0;
    for (const wp of workpacks) {
        const tag = (wp.unit_code ?? wp.title ?? 'ACT')
            .replace(/[^a-zA-Z0-9]/g, '')
            .toUpperCase()
            .slice(0, 6) || 'ACT';

        let seq = 0;
        for (const activity of wp.activities) {
            if (activity.activity_number?.trim()) continue;
            seq++;
            const code = `${tag}_${String(seq).padStart(3, '0')}`;
            await prisma.activity.update({
                where: { id: activity.id },
                data: { activity_number: code },
            });
            updated++;
        }
    }

    return NextResponse.json({ updated, workpacksProcessed: workpacks.length });
}

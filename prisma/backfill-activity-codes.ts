/**
 * Backfill activity_number for activities that don't have one.
 * Format: {TAG}_{3-digit} e.g. E435_001, E435_002
 * Run: npx tsx prisma/backfill-activity-codes.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function deriveTag(unitCode: string | null, title: string | null): string {
    const raw = (unitCode || title || 'ACT').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return raw.substring(0, 6) || 'ACT';
}

async function main() {
    const workpacks = await prisma.workpack.findMany({
        where: { deleted_at: null },
        include: {
            activities: {
                where: { deleted_at: null },
                orderBy: { sequence_number: 'asc' },
            },
        },
    });

    let updated = 0;
    for (const wp of workpacks) {
        const tag = deriveTag(wp.unit_code, wp.title);
        for (let i = 0; i < wp.activities.length; i++) {
            const act = wp.activities[i];
            if (!act.activity_number?.trim()) {
                const seq = String(i + 1).padStart(3, '0');
                const code = `${tag}_${seq}`;
                await prisma.activity.update({
                    where: { id: act.id },
                    data: { activity_number: code },
                });
                updated++;
                console.log(`  ${act.id.slice(0, 8)}… → ${code}`);
            }
        }
    }
    console.log(`Done. Updated ${updated} activities.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());

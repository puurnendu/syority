/**
 * Backfill workpack_id_code for workpacks that don't have one.
 * Run: npm run backfill:workpack-ids
 * Uses its own PrismaClient to avoid pulling in server-only modules.
 */
import { prisma, disconnect } from './seed-client';

const DISC_MAP: Record<string, string> = {
    'MECH': 'MEC', 'MECHANICAL': 'MEC', 'MEC': 'MEC',
    'PIPE': 'PIP', 'PIPING': 'PIP', 'PIP': 'PIP',
    'ELEC': 'ELC', 'ELECTRICAL': 'ELC', 'ELC': 'ELC',
    'INST': 'INS', 'INSTRUMENTATION': 'INS', 'INS': 'INS',
    'INSP': 'INP', 'INSPECTION': 'INP', 'INP': 'INP',
    'CIVL': 'CIV', 'CIVIL': 'CIV', 'CIV': 'CIV',
    'HSE': 'HSE', 'ROTAT': 'ROT', 'ROTATING': 'ROT', 'ROT': 'ROT',
    'STATIC': 'STA', 'STA': 'STA', 'STRUCT': 'STR', 'STRUCTURAL': 'STR', 'STR': 'STR',
    'GEN': 'GEN',
};

function normaliseUnit(unit: string): string {
    if (!unit) return 'GEN';
    return unit.toUpperCase().trim().replace(/[^A-Z0-9]/g, '').slice(0, 3).padEnd(3, 'X');
}

function normaliseDisc(discipline: string): string {
    if (!discipline) return 'GEN';
    const upper = discipline.toUpperCase().trim();
    if (DISC_MAP[upper]) return DISC_MAP[upper];
    for (const [key, val] of Object.entries(DISC_MAP)) {
        if (upper.startsWith(key)) return val;
    }
    return upper.replace(/[^A-Z0-9]/g, '').slice(0, 3).padEnd(3, 'X');
}



async function generateCode(orgId: string, unitCode: string, disciplineCode: string): Promise<string> {
    const unit = normaliseUnit(unitCode);
    const disc = normaliseDisc(disciplineCode);
    const counter = await prisma.workpackIdCounter.upsert({
        where: {
            organization_id_unit_code_discipline_code: {
                organization_id: orgId,
                unit_code: unit,
                discipline_code: disc,
            },
        },
        update: { last_number: { increment: 1 } },
        create: {
            organization_id: orgId,
            unit_code: unit,
            discipline_code: disc,
            last_number: 1,
        },
    });
    return `${unit}-${disc}-${String(counter.last_number).padStart(3, '0')}`;
}

async function main() {
    const workpacks = await prisma.workpack.findMany({
        where: { workpack_id_code: null, deleted_at: null },
        select: {
            id: true,
            organization_id: true,
            unit_code: true,
            title: true,
            activities: {
                select: { discipline: { select: { code: true } } },
                where: { deleted_at: null },
                take: 1,
                orderBy: { sequence_number: 'asc' },
            },
        },
    });

    console.log(`Found ${workpacks.length} workpacks without IDs`);

    let generated = 0;
    let skipped = 0;

    for (const wp of workpacks) {
        const unit = wp.unit_code ?? 'GEN';
        const disc = wp.activities?.[0]?.discipline?.code ?? 'GEN';

        try {
            const code = await generateCode(wp.organization_id, unit, disc);
            await prisma.workpack.update({
                where: { id: wp.id },
                data: { workpack_id_code: code },
            });
            console.log(`✅ ${wp.title.slice(0, 40)} → ${code}`);
            generated++;
        } catch (e: unknown) {
            console.error(`❌ ${wp.id}:`, e instanceof Error ? e.message : e);
            skipped++;
        }
    }

    console.log(`\nDone: ${generated} generated, ${skipped} skipped`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => disconnect());

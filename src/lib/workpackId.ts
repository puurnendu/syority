import { prisma } from '@/lib/prisma';

// ── Discipline abbreviation map ─────────────────────
// Left side: any code/name the user might enter
// Right side: exactly 3 chars used in the ID
const DISC_MAP: Record<string, string> = {
    // Mechanical
    'MECH': 'MEC', 'MECHANICAL': 'MEC',
    'MEC': 'MEC',
    // Piping
    'PIPE': 'PIP', 'PIPING': 'PIP',
    'PIP': 'PIP',
    // Electrical
    'ELEC': 'ELC', 'ELECTRICAL': 'ELC',
    'ELC': 'ELC',
    // Instrumentation
    'INST': 'INS', 'INSTRUMENTATION': 'INS',
    'INS': 'INS',
    // Inspection
    'INSP': 'INP', 'INSPECTION': 'INP',
    'INP': 'INP',
    // Civil
    'CIVL': 'CIV', 'CIVIL': 'CIV',
    'CIV': 'CIV',
    // HSE
    'HSE': 'HSE',
    // Rotating
    'ROTAT': 'ROT', 'ROTATING': 'ROT',
    'ROT': 'ROT',
    // Static
    'STATIC': 'STA', 'STA': 'STA',
    // Structural
    'STRUCT': 'STR', 'STRUCTURAL': 'STR',
    'STR': 'STR',
    // General / fallback
    'GEN': 'GEN',
};

/** Normalise discipline code to exactly 3 uppercase chars */
export function normaliseDiscCode(discipline: string): string {
    if (!discipline) return 'GEN';
    const upper = discipline.toUpperCase().trim();
    if (DISC_MAP[upper]) return DISC_MAP[upper];
    for (const [key, val] of Object.entries(DISC_MAP)) {
        if (upper.startsWith(key)) return val;
    }
    return upper.replace(/[^A-Z0-9]/g, '').slice(0, 3).padEnd(3, 'X');
}

/** Normalise unit code to exactly 3 uppercase alphanumeric chars */
export function normaliseUnitCode(unit: string): string {
    if (!unit) return 'GEN';
    return unit
        .toUpperCase()
        .trim()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 3)
        .padEnd(3, 'X');
}

/**
 * Atomically increment the counter and return the next formatted code, e.g. "FCC-MEC-001"
 */
export async function generateWorkpackIdCode(
    organizationId: string,
    unitCode: string,
    disciplineCode: string
): Promise<string> {
    const unit = normaliseUnitCode(unitCode);
    const disc = normaliseDiscCode(disciplineCode);

    const counter = await prisma.$transaction(async (tx) => {
        return tx.workpack_id_counters.upsert({
            where: {
                organization_id_unit_code_discipline_code: {
                    organization_id: organizationId,
                    unit_code: unit,
                    discipline_code: disc,
                },
            },
            update: {
                last_number: { increment: 1 },
                updated_at: new Date(),
            },
            create: {
                id: crypto.randomUUID(),
                organization_id: organizationId,
                unit_code: unit,
                discipline_code: disc,
                last_number: 1,
                updated_at: new Date(),
            },
        });
    });

    const seq = String(counter.last_number).padStart(3, '0');
    return `${unit}-${disc}-${seq}`;
}

/**
 * Preview the NEXT code without consuming it. Used by "Preview ID" before creation.
 */
export async function previewNextWorkpackIdCode(
    organizationId: string,
    unitCode: string,
    disciplineCode: string
): Promise<string> {
    const unit = normaliseUnitCode(unitCode);
    const disc = normaliseDiscCode(disciplineCode);
    const counter = await prisma.workpack_id_counters.findFirst({
        where: {
            organization_id: organizationId,
            unit_code: unit,
            discipline_code: disc,
        },
        select: { last_number: true },
    });

    const next = (counter?.last_number ?? 0) + 1;
    return `${unit}-${disc}-${String(next).padStart(3, '0')}`;
}

/** Check if a code is already taken (for manual override / admin). */
export async function isWorkpackIdCodeTaken(
    organizationId: string,
    code: string
): Promise<boolean> {
    const existing = await prisma.workpack.findFirst({
        where: {
            organization_id: organizationId,
            workpack_id_code: code,
            deleted_at: null,
        },
        select: { id: true },
    });
    return !!existing;
}

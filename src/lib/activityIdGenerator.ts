import { prisma } from '@/lib/prisma';

/**
 * Get the organisation's configured increment gap (default 3)
 */
export async function getActivityIdIncrement(orgId: string): Promise<number> {
    const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { activity_id_increment: true },
    });
    return org?.activity_id_increment ?? 3;
}

/**
 * Get the next available Activity ID serial for a workpack within its STO event.
 * Format: {equipment_tag_with_hyphens}_{3-digit-serial} e.g. E-421_001, E-421_004.
 * Uses the org-configured increment gap. Tag is raw tag_number (hyphens preserved).
 */
export async function generateNextActivityId(
    workpackId: string,
    orgId: string
): Promise<string> {
    const increment = await getActivityIdIncrement(orgId);

    const workpack = await prisma.workpack.findUnique({
        where: { id: workpackId },
        include: {
            asset: { select: { tag_number: true } },
        },
    });

    if (!workpack) throw new Error('Workpack not found');

    const equipmentTag = workpack.asset?.tag_number;
    if (!equipmentTag) throw new Error('Workpack has no equipment tag');

    const eventId = workpack.event_id;

    const existing = await prisma.activity.findMany({
        where: {
            event_id: eventId,
            activity_id: { startsWith: `${equipmentTag}_` },
            deleted_at: null,
        },
        select: { activity_id: true },
    });

    let maxSerial = 0;
    for (const act of existing) {
        if (!act.activity_id) continue;
        const parts = act.activity_id.split('_');
        const serial = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(serial) && serial > maxSerial) maxSerial = serial;
    }

    const nextSerial = maxSerial === 0 ? 1 : maxSerial + increment;
    return `${equipmentTag}_${String(nextSerial).padStart(3, '0')}`;
}

/**
 * Check if an activity_id is already used within the same STO event.
 * If duplicate found, return the next available suggestion.
 * Returns { available: true } if free,
 * or { available: false, suggestion: "E-421_010" } if taken (underscore separator).
 */
export async function checkActivityIdAvailability(
    activityId: string,
    workpackId: string,
    excludeActivityId?: string
): Promise<{ available: boolean; suggestion?: string }> {
    const workpack = await prisma.workpack.findUnique({
        where: { id: workpackId },
        include: {
            asset: { select: { tag_number: true } },
        },
    });
    if (!workpack) return { available: true };

    const eventId = workpack.event_id;

    const conflict = await prisma.activity.findFirst({
        where: {
            activity_id: activityId,
            event_id: eventId,
            deleted_at: null,
            ...(excludeActivityId ? { id: { not: excludeActivityId } } : {}),
        },
    });

    if (!conflict) return { available: true };

    const parts = activityId.split('_');
    const prefix = parts.slice(0, -1).join('_');
    const requestedSerial = parseInt(parts[parts.length - 1], 10);
    const orgId = workpack.organization_id;
    const increment = await getActivityIdIncrement(orgId);

    let trySerial = requestedSerial + 1;
    while (trySerial <= 999) {
        const candidate = `${prefix}_${String(trySerial).padStart(3, '0')}`;
        const taken = await prisma.activity.findFirst({
            where: {
                activity_id: candidate,
                event_id: eventId,
                deleted_at: null,
            },
        });
        if (!taken) return { available: false, suggestion: candidate };
        trySerial++;
    }

    return { available: false, suggestion: undefined };
}

/**
 * Generate next Activity Code for library entry.
 * Format: A0001, A0002... global per org, gap of 1.
 */
export async function generateNextActivityCode(orgId: string): Promise<string> {
    const last = await prisma.activityLibrary.findFirst({
        where: {
            organization_id: orgId,
            activity_code: { startsWith: 'A' },
            deleted_at: null,
        },
        orderBy: { activity_code: 'desc' },
        select: { activity_code: true },
    });

    if (!last?.activity_code) return 'A0001';

    const num = parseInt(last.activity_code.slice(1), 10);
    return isNaN(num) ? 'A0001' : `A${String(num + 1).padStart(4, '0')}`;
}

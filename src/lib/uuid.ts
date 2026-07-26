const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns true if value is a valid UUID (after trim). Use for Prisma UUID columns.
 */
export function isUuid(value: string | null | undefined): boolean {
    if (value == null) return false;
    return UUID_REGEX.test(String(value).trim());
}

/**
 * Normalize a string that may be a UUID from URL (e.g. copy-paste with spaces).
 * Replaces runs of spaces with a single hyphen so "18c5ab28 2057 4ffd 9b6c 2fb1cd018b00" becomes valid.
 * Returns the trimmed string; does not validate. Use with isUuid() after.
 */
export function normalizeUuidFromSegment(segment: string | null | undefined): string {
    if (segment == null) return '';
    return String(segment).trim().replace(/\s+/g, '-');
}

/**
 * Normalize optional UUID inputs from forms/API: empty string to null.
 * Use for optional UUID FK fields before Prisma create/update.
 */
export function normalizeUuid(v: string | null | undefined): string | null {
    if (v == null) return null;
    const s = typeof v === 'string' ? v.trim() : String(v).trim();
    return s === '' ? null : s;
}

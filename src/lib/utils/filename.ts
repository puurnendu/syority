/**
 * Sanitise a filename for use in HTTP Content-Disposition header.
 * Headers only accept Latin-1 (0–255); Unicode (e.g. em dash U+2014) causes errors.
 */
export function sanitiseFilename(name: string): string {
    return name
        .replace(/\u2014/g, '-') // em dash → hyphen
        .replace(/\u2013/g, '-') // en dash → hyphen
        .replace(/\u2018|\u2019/g, "'") // smart quotes → straight
        .replace(/\u201C|\u201D/g, '"') // smart double quotes → straight
        .replace(/[^\x00-\xFF]/g, '_') // any other non-Latin-1 → underscore
        .replace(/[/\\?%*:|"<>]/g, '-') // illegal filename chars → hyphen
        .replace(/\s+/g, ' ') // normalise whitespace
        .trim();
}

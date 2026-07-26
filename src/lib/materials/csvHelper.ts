export function objectsToCsv(
  rows: Record<string, unknown>[],
  headers: { key: string; label: string }[]
): string {
  const escape = (val: unknown): string => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const headerRow = headers.map((h) => h.label).join(',');
  const dataRows = rows.map((row) =>
    headers.map((h) => escape(row[h.key])).join(',')
  );

  return [headerRow, ...dataRows].join('\r\n');
}

export function csvToBuffer(csv: string): Buffer {
  return Buffer.concat([
    Buffer.from('\xEF\xBB\xBF', 'binary'),
    Buffer.from(csv, 'utf-8'),
  ]);
}

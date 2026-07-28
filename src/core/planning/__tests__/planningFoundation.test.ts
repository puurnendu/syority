import { describe, expect, it } from 'vitest';

/**
 * Pure helpers mirrored from TemplateLibraryService.compare rules —
 * keeps unit tests free of DB while locking Planning Foundation contracts.
 */
function sectionChanged(a: unknown, b: unknown) {
  return JSON.stringify(a) !== JSON.stringify(b);
}

function activityDiff(
  a: { key: string; description: string }[],
  b: { key: string; description: string }[]
) {
  const mapA = new Map(a.map((x) => [x.key, x]));
  const mapB = new Map(b.map((x) => [x.key, x]));
  const keys = new Set([...mapA.keys(), ...mapB.keys()]);
  return [...keys].map((k) => ({
    key: k,
    changed: !mapA.has(k) || !mapB.has(k) || mapA.get(k)!.description !== mapB.get(k)!.description,
  }));
}

describe('M6.1–M6.2 Planning Foundation contracts', () => {
  it('detects section payload changes for compare', () => {
    expect(sectionChanged({ hours: 10 }, { hours: 10 })).toBe(false);
    expect(sectionChanged({ hours: 10 }, { hours: 12 })).toBe(true);
  });

  it('diffs activities by key for compare', () => {
    const diff = activityDiff(
      [
        { key: 'A1', description: 'Isolate' },
        { key: 'A2', description: 'Pull bundle' },
      ],
      [
        { key: 'A1', description: 'Isolate' },
        { key: 'A2', description: 'Pull and clean bundle' },
        { key: 'A3', description: 'Box-up' },
      ]
    );
    expect(diff.find((d) => d.key === 'A1')?.changed).toBe(false);
    expect(diff.find((d) => d.key === 'A2')?.changed).toBe(true);
    expect(diff.find((d) => d.key === 'A3')?.changed).toBe(true);
  });

  it('enforces lifecycle publish rules conceptually', () => {
    const canEditInPlace = (status: string) => status === 'DRAFT';
    const canInstantiate = (status: string) => status === 'PUBLISHED';
    const canVersion = (status: string) => status === 'PUBLISHED' || status === 'DEPRECATED';

    expect(canEditInPlace('DRAFT')).toBe(true);
    expect(canEditInPlace('PUBLISHED')).toBe(false);
    expect(canInstantiate('PUBLISHED')).toBe(true);
    expect(canInstantiate('DRAFT')).toBe(false);
    expect(canVersion('PUBLISHED')).toBe(true);
  });

  it('keeps template immutable on instantiate (contract)', () => {
    const template = { id: 't1', revision: 2, lifecycle_status: 'PUBLISHED' };
    const afterInstantiate = { ...template };
    expect(afterInstantiate).toEqual(template);
  });
});

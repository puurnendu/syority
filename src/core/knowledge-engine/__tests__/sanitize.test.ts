import { describe, expect, it } from 'vitest';
import { contentHash, hashOrgId, sanitizeObject } from '../sanitize';
import { payloadSimilarity, recommendFromScore } from '../similarity';

describe('Knowledge Engine sanitize', () => {
  it('strips tenant identifying fields', () => {
    const cleaned = sanitizeObject({
      name: 'Hydrotest',
      organization_id: '11111111-1111-4111-8111-111111111111',
      created_by: '22222222-2222-4222-8222-222222222222',
      email: 'secret@tenant.com',
      duration_hours: 4,
      site_name: 'Refinery A',
    });
    expect(cleaned.name).toBe('Hydrotest');
    expect(cleaned.duration_hours).toBe(4);
    expect(cleaned.organization_id).toBeUndefined();
    expect(cleaned.created_by).toBeUndefined();
    expect(cleaned.email).toBeUndefined();
    expect(cleaned.site_name).toBeUndefined();
  });

  it('produces stable content hashes', () => {
    const a = contentHash('ACTIVITY_CODE', 'Hydrotest', { name: 'Hydrotest', hours: 2 });
    const b = contentHash('ACTIVITY_CODE', 'Hydrotest', { hours: 2, name: 'Hydrotest' });
    expect(a).toBe(b);
    expect(hashOrgId('org-1')).not.toBe('org-1');
  });
});

describe('Knowledge Engine similarity', () => {
  it('scores near-duplicates highly', () => {
    const score = payloadSimilarity(
      'Blind flange install',
      { name: 'Blind flange install', description: 'Install blind flange' },
      'Blind flange installation',
      { name: 'Blind flange installation', description: 'Install blind flange' }
    );
    expect(score).toBeGreaterThan(0.5);
    expect(recommendFromScore(0.95)).toBe('DUPLICATE');
    expect(recommendFromScore(0.8)).toBe('MERGE');
    expect(recommendFromScore(0.1)).toBe('NEW');
  });
});

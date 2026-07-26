import { describe, it, expect } from 'vitest';
import { extractRequestMeta } from '../requestMeta';

describe('extractRequestMeta', () => {
    it('returns nulls when no headers exist', () => {
        const req = { headers: new Headers() } as any;
        const result = extractRequestMeta(req);
        expect(result).toEqual({ ip: null, userAgent: null });
    });

    it('extracts first hop from x-forwarded-for chain', () => {
        const headers = new Headers();
        headers.set('x-forwarded-for', '203.0.113.195, 70.41.3.18, 150.172.238.178');
        const req = { headers } as any;
        const result = extractRequestMeta(req);
        expect(result.ip).toBe('203.0.113.195');
    });

    it('falls back to req.ip if x-forwarded-for is absent', () => {
        const headers = new Headers();
        const req = { headers, ip: '192.168.1.1' } as any;
        const result = extractRequestMeta(req);
        expect(result.ip).toBe('192.168.1.1');
    });

    it('handles IPv6 addresses', () => {
        const headers = new Headers();
        headers.set('x-forwarded-for', '2001:db8:3333:4444:5555:6666:7777:8888, 192.168.1.1');
        const req = { headers } as any;
        const result = extractRequestMeta(req);
        expect(result.ip).toBe('2001:db8:3333:4444:5555:6666:7777:8888');
    });

    it('extracts user-agent and truncates to 512 chars', () => {
        const headers = new Headers();
        const longUA = 'A'.repeat(600);
        headers.set('user-agent', longUA);
        const req = { headers } as any;
        const result = extractRequestMeta(req);
        expect(result.userAgent).toHaveLength(512);
        expect(result.userAgent).toBe('A'.repeat(512));
    });
});

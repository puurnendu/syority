import { NextRequest } from 'next/server';

export function extractRequestMeta(req: NextRequest | { headers: Headers, ip?: string }) {
    let ip_address: string | null = null;
    let user_agent: string | null = null;

    const forwardedFor = req.headers.get('x-forwarded-for');
    if (forwardedFor) {
        // take the first hop
        ip_address = forwardedFor.split(',')[0].trim();
    } else if ('ip' in req && req.ip) {
        ip_address = req.ip;
    }

    const ua = req.headers.get('user-agent');
    if (ua) {
        user_agent = ua.substring(0, 512);
    }

    return { ip: ip_address, userAgent: user_agent };
}

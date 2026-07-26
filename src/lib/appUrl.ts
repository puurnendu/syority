/**
 * Resolve the public application base URL without hardcoding host/port.
 *
 * Priority:
 * 1. NEXTAUTH_URL
 * 2. NEXT_PUBLIC_APP_URL
 * 3. Incoming request Host / X-Forwarded-* headers
 */
export function getAppBaseUrl(request?: {
    headers: Headers | { get(name: string): string | null | undefined };
}): string {
    const fromEnv = (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim();
    if (fromEnv) {
        return fromEnv.replace(/\/$/, '');
    }

    if (request?.headers) {
        const headers = request.headers;
        const host =
            headers.get('x-forwarded-host') ||
            headers.get('host') ||
            '';
        if (host) {
            const proto =
                headers.get('x-forwarded-proto') ||
                (host.includes('localhost') || host.startsWith('127.') ? 'http' : 'https');
            return `${proto}://${host}`.replace(/\/$/, '');
        }
    }

    return '';
}

/** Join base URL + path, or return a root-relative path when base is unknown. */
export function appUrl(path: string, request?: Parameters<typeof getAppBaseUrl>[0]): string {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    const base = getAppBaseUrl(request);
    return base ? `${base}${normalized}` : normalized;
}

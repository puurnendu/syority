import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { hasPermission } from '@/lib/permissions';
import { evaluatePathAccess, Scope, isPlatformRole, normalizeRole } from '@/security';

/** Routes that never require a session. /auth/change-password is NOT public. */
function isPublicPath(pathname: string): boolean {
    return (
        pathname.startsWith('/login') ||
        pathname.startsWith('/auth/forgot-password') ||
        pathname.startsWith('/auth/reset-password') ||
        pathname.startsWith('/onboarding') ||
        pathname.startsWith('/api/') ||
        pathname.startsWith('/_next') ||
        pathname.startsWith('/favicon.ico')
    );
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (isPublicPath(pathname)) {
        return NextResponse.next();
    }

    const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
    });

    // 1) Anonymous → always /login (including /auth/change-password)
    if (!token) {
        const loginUrl = new URL('/login', request.url);
        if (pathname !== '/' && pathname !== '/login') {
            loginUrl.searchParams.set('callbackUrl', pathname);
        }
        return NextResponse.redirect(loginUrl);
    }

    const mustChange = token.must_change_password === true;

    // 2) Authenticated + must change password → force change-password and STOP.
    //    Never run platform/tenant routing after this (avoids
    //    /auth/change-password ↔ /platform/tenants loops for platform admins).
    if (mustChange) {
        if (pathname.startsWith('/auth/change-password')) {
            return NextResponse.next();
        }
        return NextResponse.redirect(new URL('/auth/change-password', request.url));
    }

    // 3) Authenticated user who does NOT need a password change should not stay on that page
    if (pathname.startsWith('/auth/change-password')) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    const role = normalizeRole(
        (token.role as string) ??
            (Array.isArray(token.roles) ? (token.roles[0] as string) : '') ??
            ''
    );
    const roles = [
        ...new Set([
            ...(role ? [role] : []),
            ...((Array.isArray(token.roles) ? token.roles : []) as string[]).map(normalizeRole),
        ]),
    ];
    const isPlatformAdmin = roles.some(isPlatformRole);

    const proxyCookie = request.cookies.get('syority_proxy')?.value;
    const isProxyModeActive = !!proxyCookie;

    const isPlatformNamespace =
        pathname === '/platform' || pathname.startsWith('/platform/');
    const isPlatformDataNamespace =
        pathname === '/platform-data' || pathname.startsWith('/platform-data/');

    if (isPlatformNamespace) {
        if (!isPlatformAdmin) {
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }
        if (isProxyModeActive) {
            const response = NextResponse.redirect(new URL(request.url));
            response.cookies.delete('syority_proxy');
            return response;
        }
        return NextResponse.next();
    }

    if (isPlatformDataNamespace) {
        if (!isPlatformAdmin) {
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }
        return NextResponse.next();
    }

    const access = evaluatePathAccess(
        pathname,
        { role, roles, is_proxy: isProxyModeActive },
        { isProxy: isProxyModeActive }
    );

    if (access.meta && !access.ok) {
        if (access.reason === 'PLATFORM_ONLY') {
            return NextResponse.redirect(new URL('/settings', request.url));
        }
        if (access.reason === 'PROXY_REQUIRED_FOR_PLATFORM_ADMIN') {
            return NextResponse.redirect(new URL('/platform/tenants', request.url));
        }
        if (access.reason === 'MISSING_PERMISSION') {
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }
    }

    if (
        isPlatformAdmin &&
        !isProxyModeActive &&
        pathname !== '/dashboard' &&
        pathname !== '/' &&
        access.meta?.scope === Scope.TENANT
    ) {
        return NextResponse.redirect(new URL('/platform/tenants', request.url));
    }

    if (isPlatformAdmin && !isProxyModeActive && !access.meta && pathname !== '/dashboard' && pathname !== '/') {
        if (!isPlatformNamespace && !isPlatformDataNamespace) {
            return NextResponse.redirect(new URL('/platform/tenants', request.url));
        }
    }

    if (pathname === '/') {
        if (isPlatformAdmin && !isProxyModeActive) {
            return NextResponse.redirect(new URL('/platform/tenants', request.url));
        }
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    if (pathname.startsWith('/settings') && !isPlatformAdmin) {
        if (!hasPermission(role, 'settings.view')) {
            return NextResponse.redirect(new URL('/workpacks', request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

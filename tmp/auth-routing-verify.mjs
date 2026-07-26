/**
 * Auth routing verification (cookie-based, no DB dump).
 * Cases: anonymous, tenant must-change, platform must-change, normal user.
 */
import { writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:3000';

function parseSetCookie(res) {
    const raw = typeof res.headers.getSetCookie === 'function'
        ? res.headers.getSetCookie()
        : [res.headers.get('set-cookie')].filter(Boolean);
    const jar = {};
    for (const line of raw) {
        const part = String(line).split(';')[0];
        const eq = part.indexOf('=');
        if (eq > 0) jar[part.slice(0, eq)] = part.slice(eq + 1);
    }
    return jar;
}

function cookieHeader(jar) {
    return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
}

async function followRedirects(path, cookie, max = 8) {
    const hops = [];
    let url = new URL(path, BASE).toString();
    for (let i = 0; i < max; i++) {
        const res = await fetch(url, {
            method: 'GET',
            redirect: 'manual',
            headers: cookie ? { cookie } : {},
        });
        hops.push({ url: url.replace(BASE, ''), status: res.status, location: res.headers.get('location') });
        if (res.status < 300 || res.status >= 400 || !res.headers.get('location')) {
            return { finalStatus: res.status, hops };
        }
        url = new URL(res.headers.get('location'), url).toString();
    }
    return { finalStatus: 'MAX_HOPS', hops };
}

async function signIn(email, password) {
    const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
    const { csrfToken } = await csrfRes.json();
    let jar = parseSetCookie(csrfRes);

    const body = new URLSearchParams({
        csrfToken,
        email,
        password,
        callbackUrl: `${BASE}/`,
        json: 'true',
    });

    const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            cookie: cookieHeader(jar),
        },
        body,
        redirect: 'manual',
    });
    jar = { ...jar, ...parseSetCookie(loginRes) };

    const sessionRes = await fetch(`${BASE}/api/auth/session`, {
        headers: { cookie: cookieHeader(jar) },
    });
    const session = await sessionRes.json();
    return { cookie: cookieHeader(jar), session, loginStatus: loginRes.status };
}

function expect(name, cond, detail) {
    const ok = !!cond;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
    return ok;
}

async function main() {
    const results = [];
    let pass = 0;
    let fail = 0;

    // 1) Anonymous
    {
        const r = await followRedirects('/');
        const loc = r.hops[0]?.location || '';
        const ok = expect('anonymous / → /login', r.hops[0]?.status === 307 && loc.includes('/login'), JSON.stringify(r.hops[0]));
        ok ? pass++ : fail++;
        results.push({ case: 'anonymous /', ...r });
    }
    {
        const r = await followRedirects('/auth/change-password');
        const loc = r.hops[0]?.location || '';
        const ok = expect(
            'anonymous /auth/change-password → /login',
            r.hops[0]?.status === 307 && loc.includes('/login') && !loc.includes('change-password') === false
                ? loc.startsWith('/login')
                : loc.includes('/login'),
            JSON.stringify(r.hops[0])
        );
        // stronger: first hop must be login, never stay on change-password with 200
        const ok2 = r.hops[0]?.status === 307 && (r.hops[0]?.location || '').includes('/login');
        if (!ok2) {
            console.log('FAIL  anonymous change-password first hop');
            fail++;
        } else {
            pass++;
        }
        results.push({ case: 'anonymous change-password', ...r });
    }

    const tenantEmail = process.env.TENANT_EMAIL || 'audit-admin@syority.test';
    const platformEmail = process.env.PLATFORM_EMAIL || 'info@syority.com';
    const password = process.env.TEST_PASSWORD || 'Admin@123';

    // 2) Tenant admin login destination
    {
        const { cookie, session } = await signIn(tenantEmail, password);
        const must = session?.user?.must_change_password === true;
        const rRoot = await followRedirects('/', cookie);
        const rDash = await followRedirects('/dashboard', cookie);
        const rCp = await followRedirects('/auth/change-password', cookie);

        if (must) {
            const ok1 = expect(
                'tenant must_change / → /auth/change-password',
                rRoot.hops.some((h) => (h.location || '').includes('/auth/change-password')) ||
                    rRoot.hops[rRoot.hops.length - 1]?.url.includes('/auth/change-password'),
                JSON.stringify(rRoot.hops)
            );
            const ok2 = expect(
                'tenant must_change /dashboard → /auth/change-password',
                rDash.hops.some((h) => (h.location || '').includes('/auth/change-password')),
                JSON.stringify(rDash.hops)
            );
            const ok3 = expect(
                'tenant must_change /auth/change-password → 200 (no loop)',
                rCp.finalStatus === 200 && rCp.hops.length === 1,
                JSON.stringify(rCp.hops)
            );
            ok1 && ok2 && ok3 ? (pass += 3) : (fail += [ok1, ok2, ok3].filter((x) => !x).length + (ok1 && ok2 && ok3 ? 0 : 0));
            if (!ok1) fail++;
            if (!ok2) fail++;
            if (!ok3) fail++;
            if (ok1) pass++;
            if (ok2) pass++;
            if (ok3) pass++;
        } else {
            const last = rRoot.hops[rRoot.hops.length - 1];
            const dest = last?.url || last?.location || '';
            const ok = expect(
                'tenant normal → /dashboard (or tenant home, not change-password)',
                !rRoot.hops.some((h) => (h.location || '').includes('/auth/change-password')) &&
                    (dest.includes('/dashboard') ||
                        rRoot.hops.some((h) => (h.location || '').includes('/dashboard'))),
                `must_change=${must} hops=${JSON.stringify(rRoot.hops)}`
            );
            ok ? pass++ : fail++;
        }
        results.push({ case: 'tenant', must, sessionUser: session?.user?.email, rRoot, rDash, rCp });
    }

    // 3) Platform admin login destination
    {
        const { cookie, session } = await signIn(platformEmail, password);
        const must = session?.user?.must_change_password === true;
        const rRoot = await followRedirects('/', cookie);
        const rCp = await followRedirects('/auth/change-password', cookie);
        const rDash = await followRedirects('/dashboard', cookie);

        if (must) {
            const ok1 = expect(
                'platform must_change / → /auth/change-password',
                rRoot.hops.some((h) => (h.location || '').includes('/auth/change-password')),
                JSON.stringify(rRoot.hops)
            );
            const ok2 = expect(
                'platform must_change /dashboard → /auth/change-password',
                rDash.hops.some((h) => (h.location || '').includes('/auth/change-password')),
                JSON.stringify(rDash.hops)
            );
            const ok3 = expect(
                'platform must_change /auth/change-password → 200 (no loop)',
                rCp.finalStatus === 200 && rCp.hops.length === 1,
                JSON.stringify(rCp.hops)
            );
            if (ok1) pass++; else fail++;
            if (ok2) pass++; else fail++;
            if (ok3) pass++; else fail++;
        } else {
            // Platform normal: / may go to /platform/tenants; must NOT go to change-password
            const ok = expect(
                'platform normal → not /auth/change-password',
                !rRoot.hops.some((h) => (h.location || h.url || '').includes('/auth/change-password')),
                JSON.stringify(rRoot.hops)
            );
            const okDash = expect(
                'platform normal /dashboard allowed or platform redirect (not change-password)',
                !rDash.hops.some((h) => (h.location || '').includes('/auth/change-password')),
                JSON.stringify(rDash.hops)
            );
            // change-password should bounce away when must=false
            const bounced =
                rCp.hops.some((h) => (h.location || '').includes('/dashboard')) ||
                rCp.hops.some((h) => (h.location || '').includes('/platform'));
            const okCp = expect(
                'platform normal /auth/change-password → leave page',
                bounced,
                JSON.stringify(rCp.hops)
            );
            if (ok) pass++; else fail++;
            if (okDash) pass++; else fail++;
            if (okCp) pass++; else fail++;
        }
        results.push({ case: 'platform', must, sessionUser: session?.user?.email, rRoot, rDash, rCp });
    }

    // Loop check: anonymous change-password → login (stop; login is public)
    {
        const r = await followRedirects('/auth/change-password');
        const loop = r.hops.filter((h) => (h.location || h.url || '').includes('/auth/change-password')).length > 1;
        const ok = expect('no anon redirect loop on change-password', !loop && r.hops.length <= 2, JSON.stringify(r.hops));
        ok ? pass++ : fail++;
    }

    console.log(`\nTOTAL  pass=${pass} fail=${fail}`);
    writeFileSync('tmp/auth-routing-verify.json', JSON.stringify({ pass, fail, results }, null, 2));
    process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});

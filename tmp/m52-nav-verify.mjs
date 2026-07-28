const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';
const EMAIL = process.env.PLATFORM_EMAIL || 'info@syority.com';
const PASS = process.env.TEST_PASSWORD || 'Admin@123';

const jar = new Map();
function store(res) {
  for (const c of res.headers.getSetCookie?.() || []) {
    const [p] = c.split(';');
    const i = p.indexOf('=');
    if (i > 0) jar.set(p.slice(0, i), p.slice(i + 1));
  }
}
function cookie() {
  return [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
}

const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
store(csrfRes);
const { csrfToken } = await csrfRes.json();
const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: cookie() },
  body: new URLSearchParams({
    csrfToken,
    email: EMAIL,
    password: PASS,
    callbackUrl: `${BASE}/platform/dashboard`,
    json: 'true',
  }),
  redirect: 'manual',
});
store(loginRes);

const checks = [];
for (const path of ['/platform/dashboard', '/platform/tenants', '/dashboard', '/platform', '/']) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { cookie: cookie() },
    redirect: 'manual',
  });
  const loc = res.headers.get('location');
  checks.push({ path, status: res.status, location: loc });
  console.log(`${path} -> ${res.status} ${loc || '(no redirect)'}`);
}

const html = await fetch(`${BASE}/platform/dashboard`, {
  headers: { cookie: cookie() },
}).then((r) => r.text());

const hasPlatformDashLink = html.includes('href="/platform/dashboard"');
const hasBareDashboardLink = /href="\/dashboard"/.test(html);
const hasTenantsMenu = html.includes('href="/platform/tenants"');
const isDashboardPage = /Platform Dashboard/i.test(html.replace(/<script[\s\S]*?<\/script>/gi, ' '));

console.log('hasPlatformDashLink', hasPlatformDashLink);
console.log('hasBareDashboardLink', hasBareDashboardLink);
console.log('hasTenantsMenu', hasTenantsMenu);
console.log('isDashboardPage', isDashboardPage);

const dashOk = checks.find((c) => c.path === '/platform/dashboard');
const tenantsOk = checks.find((c) => c.path === '/platform/tenants');
const tenantDashBounce = checks.find((c) => c.path === '/dashboard');
const rootBounce = checks.find((c) => c.path === '/');
const platformRoot = checks.find((c) => c.path === '/platform');

const pass =
  dashOk?.status === 200 &&
  tenantsOk?.status === 200 &&
  !!tenantDashBounce?.location?.includes('/platform/dashboard') &&
  !!rootBounce?.location?.includes('/platform/dashboard') &&
  !!platformRoot?.location?.includes('/platform/dashboard') &&
  hasPlatformDashLink &&
  !hasBareDashboardLink &&
  hasTenantsMenu &&
  isDashboardPage;

if (!pass) {
  console.log({
    dashOk,
    tenantsOk,
    tenantDashBounce,
    rootBounce,
    platformRoot,
    hasPlatformDashLink,
    hasBareDashboardLink,
    hasTenantsMenu,
    isDashboardPage,
  });
}

console.log(pass ? '\nPASS nav wiring' : '\nFAIL nav wiring');
process.exit(pass ? 0 : 1);

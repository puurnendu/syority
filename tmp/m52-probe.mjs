const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';
const EMAIL = process.env.PLATFORM_EMAIL || 'info@syority.com';
const PASS = process.env.TEST_PASSWORD || 'Admin@123';

const routes = [
  '/platform/dashboard',
  '/platform/tenants',
  '/platform/users',
  '/platform/features',
  '/platform/billing',
  '/platform/ai-config',
  '/platform/system',
  '/platform/storage',
  '/platform/backups',
  '/platform/logs',
  '/platform/monitoring',
  '/platform/onboarding',
  '/platform/setup',
  '/platform-data',
  '/platform-data/master-data/equipment-types',
  '/platform-data/master-data/activity-codes',
  '/platform-data/master-data/disciplines',
  '/platform-data/master-data/resources',
  '/platform-data/master-data/item-catalog',
  '/platform-data/master-data/gaskets',
  '/platform-data/master-data/consumables',
  '/platform-data/master-data/bolts',
  '/platform-data/master-data/blinds',
  '/platform-data/templates', // alias → workpack-templates
  '/platform-data/workpack-templates',
  '/platform-data/udf-definitions',
  '/platform-data/certificate-templates',
  '/platform-data/print-settings',
];

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
    callbackUrl: `${BASE}/platform/tenants`,
    json: 'true',
  }),
  redirect: 'manual',
});
store(loginRes);

for (const path of routes) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { cookie: cookie(), Accept: 'text/html' },
    redirect: 'follow',
  });
  const html = await res.text();
  const signals = [];
  if (res.status === 404 || /could not be found/i.test(html)) signals.push('404');
  if (res.status >= 500 || /Application error|Unhandled Runtime/i.test(html)) signals.push('ERROR');
  if (/Coming Soon/i.test(html)) signals.push('COMING_SOON');
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (res.status === 200 && body.length < 100) signals.push('BLANK');
  const finalPath = res.url.replace(BASE, '');
  // Master-data / platform-data pages must not bounce to tenants unexpectedly
  if (
    path.startsWith('/platform-data') &&
    finalPath.startsWith('/platform/tenants') &&
    path !== '/platform-data'
  ) {
    signals.push('BOUNCE_TENANTS');
  }
  // Alias route is OK if it lands on the canonical workpack templates page
  if (path === '/platform-data/templates' && finalPath.startsWith('/platform-data/workpack-templates')) {
    const idx = signals.indexOf('BOUNCE_TENANTS');
    if (idx >= 0) signals.splice(idx, 1);
  }
  const bad = signals.some((s) => ['404', 'ERROR', 'BLANK', 'BOUNCE_TENANTS'].includes(s));
  console.log(
    `${bad ? 'FAIL' : 'PASS'} ${path} ${res.status} ${signals.join(',') || '-'} final=${finalPath}`
  );
}

/** Authenticated HTML checks for hierarchy pages + console-less content assertions */
const BASE = process.env.APP_URL || 'http://127.0.0.1:3000';
const EMAIL = process.env.M5_EMAIL || 'audit-admin@syority.test';
const PASS = process.env.M5_PASSWORD || 'Admin@123';
const cookieJar = new Map();
const results = [];
const pass = (id, d = '') => { results.push({ id, status: 'PASS', d }); console.log('PASS', id, d); };
const fail = (id, d = '') => { results.push({ id, status: 'FAIL', d }); console.log('FAIL', id, d); };

function storeCookies(res) {
  for (const c of res.headers.getSetCookie?.() || []) {
    const [pair] = c.split(';');
    const i = pair.indexOf('=');
    if (i > 0) cookieJar.set(pair.slice(0, i), pair.slice(i + 1));
  }
}
const cookieHeader = () => [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');

async function login() {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  storeCookies(csrfRes);
  const { csrfToken } = await csrfRes.json();
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: cookieHeader() },
    body: new URLSearchParams({ csrfToken, email: EMAIL, password: PASS, callbackUrl: `${BASE}/dashboard`, json: 'true' }),
    redirect: 'manual',
  });
  storeCookies(res);
  const session = await fetch(`${BASE}/api/auth/session`, { headers: { cookie: cookieHeader() } });
  storeCookies(session);
  const data = await session.json();
  if (!data?.user) throw new Error('login failed');
  return data.user;
}

async function checkPage(path, mustInclude = []) {
  const res = await fetch(`${BASE}${path}`, { headers: { cookie: cookieHeader() } });
  const html = await res.text();
  if (res.status !== 200) {
    fail(`ui.${path}`, `status=${res.status}`);
    return;
  }
  if (/Application error|Internal Server Error|__next_error__|Cannot read properties/i.test(html)) {
    fail(`ui.${path}`, 'error marker in HTML');
    return;
  }
  for (const s of mustInclude) {
    if (!html.includes(s)) {
      fail(`ui.${path}`, `missing "${s}"`);
      return;
    }
  }
  pass(`ui.${path}`, `len=${html.length}`);
}

async function main() {
  await login();
  // Client-rendered buttons (+ Add) may be absent from SSR HTML — check titles/copy.
  await checkPage('/settings/hierarchy/sites', ['Sites', 'Physical locations']);
  await checkPage('/settings/hierarchy/plants', ['Plants', 'Process plants']);
  await checkPage('/settings/hierarchy/areas', ['Areas', 'Optional zones']);
  await checkPage('/settings/hierarchy/units', ['Units', 'Process units']);
  await checkPage('/settings/hierarchy/systems', ['Systems', 'Process systems']);
  await checkPage('/settings/hierarchy/assets', ['Assets', 'Tagged equipment']);

  // Settings sidebar is client-rendered (useSession) — hrefs are not in SSR HTML.
  // Verify breadcrumb parent `/settings/hierarchy` resolves (was 404 before).
  const idx = await fetch(`${BASE}/settings/hierarchy`, {
    headers: { cookie: cookieHeader() },
    redirect: 'manual',
  });
  if ([200, 302, 307, 308].includes(idx.status)) pass('nav.breadcrumb.parent', `status=${idx.status}`);
  else fail('nav.breadcrumb.parent', `status=${idx.status}`);

  // Source-of-truth: navigation.ts contains hierarchy group entries
  const fs = await import('fs');
  const navSrc = fs.readFileSync('src/security/navigation.ts', 'utf8');
  for (const href of [
    '/settings/hierarchy/sites',
    '/settings/hierarchy/plants',
    '/settings/hierarchy/areas',
    '/settings/hierarchy/units',
    '/settings/hierarchy/systems',
    '/settings/hierarchy/assets',
  ]) {
    if (navSrc.includes(`href: '${href}'`)) pass(`nav.metadata.${href}`);
    else fail(`nav.metadata.${href}`);
  }

  // Broken coming-soon assets page still points at /settings/sites (not hierarchy)
  const assetsSoon = await fetch(`${BASE}/settings/assets`, { headers: { cookie: cookieHeader() } });
  const assetsHtml = await assetsSoon.text();
  if (assetsHtml.includes('/settings/hierarchy/assets') || !assetsHtml.includes('Coming Soon')) {
    pass('brokenlinks.settings.assets');
  } else if (assetsHtml.includes('/settings/sites')) {
    fail('brokenlinks.settings.assets', 'still links to /settings/sites Coming Soon page');
  } else {
    pass('brokenlinks.settings.assets', 'no legacy sites link');
  }

  // Runtime API after UI build — ensure areas list returns created data
  const areas = await fetch(`${BASE}/api/hierarchy/areas?status=active&pageSize=5`, {
    headers: { cookie: cookieHeader() },
  });
  const areasData = await areas.json();
  if (areas.ok && Array.isArray(areasData.items)) pass('runtime.areas.list', `n=${areasData.items.length}`);
  else fail('runtime.areas.list', JSON.stringify(areasData));

  const failed = results.filter((r) => r.status === 'FAIL');
  console.log(`\nPASS ${results.length - failed.length} FAIL ${failed.length}`);
  if (failed.length) console.log(failed);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * M5.1 Platform UI audit — cookie login + route probe (status, body signals, APIs).
 */
import { writeFileSync, mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';
const EMAIL = process.env.PLATFORM_EMAIL || 'info@syority.com';
const PASS = process.env.TEST_PASSWORD || 'Admin@123';

const ROUTES = [
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
  // also present in nav
  '/platform/onboarding',
  '/platform/setup',
];

const cookieJar = new Map();

function storeCookies(res) {
  const raw = res.headers.getSetCookie?.() || [];
  for (const c of raw) {
    const [pair] = c.split(';');
    const i = pair.indexOf('=');
    if (i > 0) cookieJar.set(pair.slice(0, i), pair.slice(i + 1));
  }
}

function cookieHeader() {
  return [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

async function login() {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  storeCookies(csrfRes);
  const { csrfToken } = await csrfRes.json();
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      cookie: cookieHeader(),
    },
    body: new URLSearchParams({
      csrfToken,
      email: EMAIL,
      password: PASS,
      callbackUrl: `${BASE}/platform/tenants`,
      json: 'true',
    }),
    redirect: 'manual',
  });
  storeCookies(res);
  const sessionRes = await fetch(`${BASE}/api/auth/session`, {
    headers: { cookie: cookieHeader() },
  });
  storeCookies(sessionRes);
  const session = await sessionRes.json();
  return session;
}

function classify(html, status, finalUrl) {
  const signals = [];
  if (status === 404) signals.push('HTTP_404');
  if (status >= 500) signals.push(`HTTP_${status}`);
  if (/Application error|Unhandled Runtime Error|React Error|error-overlay|__next_error__/i.test(html)) {
    signals.push('REACT_ERROR_OVERLAY');
  }
  if (/Hydration failed|Text content does not match|did not match/i.test(html)) {
    signals.push('HYDRATION_ERROR');
  }
  if (/This page could not be found|404: This page could not be found/i.test(html)) {
    signals.push('NEXT_NOT_FOUND');
  }
  if (/Coming Soon|Planned for/i.test(html)) signals.push('COMING_SOON');
  if (/Something went wrong|Internal Server Error/i.test(html)) signals.push('SERVER_ERROR_UI');
  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (status === 200 && bodyText.length < 80) signals.push('LIKELY_BLANK');
  return { signals, bodyLen: bodyText.length, snippet: bodyText.slice(0, 180), finalUrl };
}

async function probe(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { cookie: cookieHeader(), Accept: 'text/html' },
    redirect: 'follow',
  });
  const html = await res.text();
  const finalUrl = res.url;
  const cls = classify(html, res.status, finalUrl);
  const finalPath = finalUrl.replace(BASE, '').replace(/^https?:\/\/[^/]+/, '');
  return {
    path,
    status: res.status,
    finalUrl: finalPath,
    redirectedAway: !finalPath.startsWith(path.split('?')[0]) && !finalPath.includes(path),
    ...cls,
  };
}

async function main() {
  mkdirSync('tmp/m51', { recursive: true });
  const session = await login();
  if (!session?.user) {
    console.error('LOGIN_FAIL', session);
    process.exit(1);
  }
  console.log(
    `LOGIN ok email=${session.user.email} must_change=${session.user.must_change_password}`
  );

  const results = [];
  for (const path of ROUTES) {
    const r = await probe(path);
    const bad = r.signals.some((s) =>
      ['HTTP_404', 'NEXT_NOT_FOUND', 'REACT_ERROR_OVERLAY', 'HYDRATION_ERROR', 'SERVER_ERROR_UI', 'LIKELY_BLANK'].includes(s) ||
      s.startsWith('HTTP_5')
    );
    const okComingSoon = r.signals.includes('COMING_SOON') && r.status === 200;
    const bounced =
      String(r.finalUrl).includes('/login') ||
      String(r.finalUrl).includes('/auth/change-password') ||
      (r.redirectedAway && !okComingSoon);
    const pass = !bounced && ((!bad && r.status === 200) || okComingSoon);
    results.push({ ...r, pass });
    console.log(
      `${pass ? 'PASS' : 'FAIL'}  ${path} status=${r.status} final=${r.finalUrl} signals=${r.signals.join(',') || '-'}`
    );
  }

  writeFileSync('tmp/m51/audit.json', JSON.stringify({ session: session.user.email, results }, null, 2));
  const fail = results.filter((r) => !r.pass).length;
  console.log(`\nTOTAL pass=${results.length - fail} fail=${fail}`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

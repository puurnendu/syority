/**
 * Diagnostic only — does not modify app code.
 * Logs JWT must_change_password, session claim, and DB value for audit-admin.
 */
import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const base = process.env.APP_URL || 'http://127.0.0.1:3000';
const email = process.env.AUDIT_EMAIL || 'audit-admin@syority.test';
const password = process.env.AUDIT_PASSWORD || 'Admin@123';
const databaseUrl =
  process.env.DATABASE_URL ||
  'postgresql://user:pass@127.0.0.1:5433/syority?schema=public';
const secret = process.env.NEXTAUTH_SECRET;

const jar = new Map();
function store(res) {
  const raw = res.headers.getSetCookie?.() || [];
  for (const c of raw) {
    const [pair] = c.split(';');
    const i = pair.indexOf('=');
    if (i > 0) jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
}
function cookie() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

function b64urlDecode(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  return Buffer.from((s + pad).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function decodeJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  return JSON.parse(b64urlDecode(parts[1]));
}

async function main() {
  const out = [];
  const log = (m) => {
    out.push(m);
    console.log(m);
  };

  // 1) Database
  const pool = new Pool({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const dbUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, must_change_password: true },
  });
  log(`database.must_change_password = ${JSON.stringify(dbUser?.must_change_password)}`);
  log(`database.user = ${JSON.stringify(dbUser)}`);

  // 2) Login to get session cookie / JWT
  const csrfRes = await fetch(`${base}/api/auth/csrf`);
  store(csrfRes);
  const { csrfToken } = await csrfRes.json();

  const loginRes = await fetch(`${base}/api/auth/callback/credentials`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      cookie: cookie(),
    },
    body: new URLSearchParams({
      csrfToken,
      email,
      password,
      callbackUrl: `${base}/dashboard`,
      json: 'true',
    }),
  });
  store(loginRes);
  log(`login.status = ${loginRes.status}`);
  log(`login.location = ${loginRes.headers.get('location')}`);
  log(`cookies = ${[...jar.keys()].join(', ')}`);

  // Prefer next-auth session token cookie names
  const sessionCookie =
    jar.get('next-auth.session-token') ||
    jar.get('__Secure-next-auth.session-token') ||
    jar.get('authjs.session-token') ||
    jar.get('__Secure-authjs.session-token');

  let tokenPayload = null;
  if (sessionCookie) {
    // NextAuth JWTs are JWE (encrypted) when using default encryption — try decode; if fails, note that
    try {
      tokenPayload = decodeJwtPayload(decodeURIComponent(sessionCookie));
      log(`jwt_decode_ok = ${!!tokenPayload}`);
      if (tokenPayload) {
        log(`token.must_change_password = ${JSON.stringify(tokenPayload.must_change_password)}`);
        log(`token.email = ${JSON.stringify(tokenPayload.email)}`);
        log(`token.sub = ${JSON.stringify(tokenPayload.sub)}`);
      }
    } catch (e) {
      log(`jwt_raw_decode_failed = ${e.message}`);
      log('note = session cookie is likely JWE-encrypted; reading via /api/auth/session instead');
    }
  } else {
    log('session_cookie = MISSING');
  }

  // 3) Session endpoint (uses session() callback → copies from JWT)
  const sessRes = await fetch(`${base}/api/auth/session`, {
    headers: { cookie: cookie() },
  });
  const session = await sessRes.json();
  log(`session.user.must_change_password = ${JSON.stringify(session?.user?.must_change_password)}`);
  log(`session.user.email = ${JSON.stringify(session?.user?.email)}`);
  log(`session.user.id = ${JSON.stringify(session?.user?.id)}`);

  // 4) Hit a page that middleware gates
  const dashRes = await fetch(`${base}/dashboard`, {
    redirect: 'manual',
    headers: { cookie: cookie() },
  });
  log(`GET /dashboard status = ${dashRes.status}`);
  log(`GET /dashboard location = ${dashRes.headers.get('location')}`);

  const rootRes = await fetch(`${base}/`, {
    redirect: 'manual',
    headers: { cookie: cookie() },
  });
  log(`GET / status = ${rootRes.status}`);
  log(`GET / location = ${rootRes.headers.get('location')}`);

  // Summary
  log('--- SUMMARY ---');
  log(`DB=${dbUser?.must_change_password} SESSION=${session?.user?.must_change_password} DASH_REDIRECT=${dashRes.headers.get('location')}`);

  fs.writeFileSync('scripts/_must_change_probe_out.txt', out.join('\n') + '\n');
  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

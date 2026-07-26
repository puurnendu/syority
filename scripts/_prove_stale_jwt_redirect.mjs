/**
 * Prove stale JWT redirects even when DB is false.
 * Does not modify application source — only temporary DB toggle for the probe user.
 */
import { createRequire } from 'node:module';
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

const jar = new Map();
function store(res) {
  for (const c of res.headers.getSetCookie?.() || []) {
    const [pair] = c.split(';');
    const i = pair.indexOf('=');
    if (i > 0) jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
}
function cookie() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

async function login() {
  jar.clear();
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
  return loginRes.status;
}

async function sessionFlag() {
  const sessRes = await fetch(`${base}/api/auth/session`, {
    headers: { cookie: cookie() },
  });
  const session = await sessRes.json();
  return session?.user?.must_change_password;
}

async function dashLocation() {
  const dashRes = await fetch(`${base}/dashboard`, {
    redirect: 'manual',
    headers: { cookie: cookie() },
  });
  return { status: dashRes.status, location: dashRes.headers.get('location') };
}

async function main() {
  const pool = new Pool({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    // Restore known-good end state later
    const original = await prisma.user.findUnique({
      where: { email },
      select: { must_change_password: true },
    });
    console.log('STEP0 original DB =', original?.must_change_password);

    // A) Force DB true, login → JWT embeds true
    await prisma.user.update({
      where: { email },
      data: { must_change_password: true },
    });
    console.log('STEP1 DB set true, login…');
    console.log('login.status =', await login());
    console.log('session.must_change_password =', await sessionFlag());
    console.log('dashboard =', await dashLocation());

    // B) Clear DB to false WITHOUT re-login (JWT still true)
    await prisma.user.update({
      where: { email },
      data: { must_change_password: false },
    });
    const dbNow = await prisma.user.findUnique({
      where: { email },
      select: { must_change_password: true },
    });
    console.log('STEP2 DB cleared to', dbNow?.must_change_password, '(same cookie, no re-login)');
    console.log('session.must_change_password =', await sessionFlag());
    console.log('dashboard =', await dashLocation());

    // C) Fresh login after DB false → should NOT redirect
    console.log('STEP3 fresh login with DB false…');
    console.log('login.status =', await login());
    console.log('session.must_change_password =', await sessionFlag());
    console.log('dashboard =', await dashLocation());

    // Restore original
    await prisma.user.update({
      where: { email },
      data: { must_change_password: original?.must_change_password ?? false },
    });
    console.log('RESTORED DB to', original?.must_change_password ?? false);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/** Login and print session cookie name/value for browser CDP injection (no secrets beyond session). */
const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';
const EMAIL = process.env.PLATFORM_EMAIL || 'info@syority.com';
const PASS = process.env.TEST_PASSWORD || 'Admin@123';

const jar = new Map();
function store(res) {
  for (const c of res.headers.getSetCookie?.() || []) {
    const [pair] = c.split(';');
    const i = pair.indexOf('=');
    if (i > 0) jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
}

const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
store(csrfRes);
const { csrfToken } = await csrfRes.json();
const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    cookie: [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; '),
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
store(loginRes);

const cookies = [...jar.entries()].map(([name, value]) => ({ name, value }));
process.stdout.write(JSON.stringify({ cookies }, null, 0));

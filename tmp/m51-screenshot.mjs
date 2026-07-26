import puppeteer from 'puppeteer';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';
const EMAIL = process.env.PLATFORM_EMAIL || 'info@syority.com';
const PASS = process.env.TEST_PASSWORD || 'Admin@123';
const OUT = 'tmp/m51/screenshots';

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
];

mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

const results = [];

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
await page.waitForSelector('input[type="email"], input[name="email"], input[placeholder*="syority"]');
const emailSel = await page.$('input[type="email"]') || await page.$('input[placeholder*="@"]');
const passSel = await page.$('input[type="password"]');
await emailSel.click({ clickCount: 3 });
await emailSel.type(EMAIL, { delay: 10 });
await passSel.click({ clickCount: 3 });
await passSel.type(PASS, { delay: 10 });
await Promise.all([
  page.click('button[type="submit"]'),
  page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => null),
]);

// If must_change or still on login, record and continue
let afterLogin = page.url();
if (afterLogin.includes('/login')) {
  // try form submit again via enter
  await passSel.focus();
  await page.keyboard.press('Enter');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => null);
  afterLogin = page.url();
}

for (const path of ROUTES) {
  const consoleErrors = [];
  const pageErrors = [];
  const failedApis = [];

  const onConsole = (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  };
  const onPageError = (err) => pageErrors.push(String(err));
  const onResponse = (res) => {
    const u = res.url();
    if (u.includes('/api/') && res.status() >= 400) {
      failedApis.push({ url: u.replace(BASE, ''), status: res.status() });
    }
  };
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('response', onResponse);

  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2', timeout: 45000 }).catch((e) => {
    pageErrors.push(String(e));
  });
  await new Promise((r) => setTimeout(r, 800));

  const slug = path.replace(/\//g, '_').replace(/^_/, '');
  const file = join(OUT, `${slug}.png`);
  await page.screenshot({ path: file, fullPage: false });

  const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 400) || '');
  const hasOverlay = await page.evaluate(
    () => !!document.querySelector('nextjs-portal') || /Application error|Unhandled Runtime Error/i.test(document.body?.innerText || '')
  );
  const comingSoon = /Coming Soon/i.test(bodyText);

  page.off('console', onConsole);
  page.off('pageerror', onPageError);
  page.off('response', onResponse);

  const pass =
    page.url().includes(path) &&
    !hasOverlay &&
    pageErrors.length === 0 &&
    !/This page could not be found/i.test(bodyText);

  results.push({
    path,
    finalUrl: page.url().replace(BASE, ''),
    screenshot: file,
    comingSoon,
    hasOverlay,
    consoleErrors: consoleErrors.slice(0, 10),
    pageErrors: pageErrors.slice(0, 10),
    failedApis: failedApis.slice(0, 10),
    pass,
    snippet: bodyText.replace(/\s+/g, ' ').slice(0, 120),
  });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${path} overlay=${hasOverlay} console=${consoleErrors.length} apis=${failedApis.length}`);
}

writeFileSync('tmp/m51/browser-audit.json', JSON.stringify({ afterLogin, results }, null, 2));
await browser.close();
const fail = results.filter((r) => !r.pass).length;
console.log(`\nBROWSER pass=${results.length - fail} fail=${fail}`);
process.exit(fail ? 1 : 0);

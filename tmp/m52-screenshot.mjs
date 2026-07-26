import puppeteer from 'puppeteer';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';
const EMAIL = process.env.PLATFORM_EMAIL || 'info@syority.com';
const PASS = process.env.TEST_PASSWORD || 'Admin@123';
const OUT = 'tmp/m52/screenshots';

const ROUTES = [
  '/platform/dashboard',
  '/platform/tenants',
  '/platform/users',
  '/platform/features',
  '/platform/billing',
  '/platform/ai-config',
  '/platform/system',
  '/platform/storage',
  '/platform/onboarding',
  '/platform-data',
  '/platform-data/master-data/equipment-types',
  '/platform-data/master-data/item-catalog',
  '/platform-data/templates',
  '/platform-data/udf-definitions',
  '/platform-data/print-settings',
  '/platform-data/certificate-templates',
  '/platform-data/workpack-templates',
];

mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
const emailSel = (await page.$('input[type="email"]')) || (await page.$('input[placeholder*="@"]'));
const passSel = await page.$('input[type="password"]');
await emailSel.click({ clickCount: 3 });
await emailSel.type(EMAIL, { delay: 5 });
await passSel.click({ clickCount: 3 });
await passSel.type(PASS, { delay: 5 });
await Promise.all([
  page.click('button[type="submit"]'),
  page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => null),
]);

const results = [];
for (const path of ROUTES) {
  const pageErrors = [];
  const failedApis = [];
  const onPageError = (err) => pageErrors.push(String(err));
  const onResponse = (res) => {
    const u = res.url();
    if (u.includes('/api/') && res.status() >= 500) {
      failedApis.push({ url: u.replace(BASE, ''), status: res.status() });
    }
  };
  page.on('pageerror', onPageError);
  page.on('response', onResponse);

  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2', timeout: 45000 }).catch((e) => {
    pageErrors.push(String(e));
  });
  await new Promise((r) => setTimeout(r, 600));

  const slug = path.replace(/\//g, '_').replace(/^_/, '');
  const file = join(OUT, `${slug}.png`);
  await page.screenshot({ path: file, fullPage: false });

  const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 500) || '');
  const hasOverlay = /Application error|Unhandled Runtime Error/i.test(bodyText);
  const comingSoon = /Coming Soon/i.test(bodyText);
  const bounced = page.url().includes('/platform/tenants') && !path.includes('/tenants');
  const pass =
    !hasOverlay &&
    pageErrors.length === 0 &&
    !/could not be found/i.test(bodyText) &&
    !bounced;

  page.off('pageerror', onPageError);
  page.off('response', onResponse);

  results.push({
    path,
    finalUrl: page.url().replace(BASE, ''),
    screenshot: file,
    comingSoon,
    hasOverlay,
    pageErrors: pageErrors.slice(0, 5),
    failedApis: failedApis.slice(0, 5),
    pass,
    snippet: bodyText.replace(/\s+/g, ' ').slice(0, 140),
  });
  console.log(
    `${pass ? 'PASS' : 'FAIL'} ${path} soon=${comingSoon} overlay=${hasOverlay} apis5xx=${failedApis.length}`
  );
}

writeFileSync('tmp/m52/browser-audit.json', JSON.stringify({ results }, null, 2));
await browser.close();
const fail = results.filter((r) => !r.pass).length;
console.log(`\nBROWSER pass=${results.length - fail} fail=${fail}`);
process.exit(fail ? 1 : 0);

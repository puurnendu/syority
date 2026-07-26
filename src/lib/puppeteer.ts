import puppeteer, { Browser } from 'puppeteer';

let browser: Browser | null = null;

const LAUNCH_ARGS = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-zygote',
];

export async function getBrowser(): Promise<Browser> {
    if (!browser || !browser.connected) {
        browser = await puppeteer.launch({
            headless: true,
            args: LAUNCH_ARGS,
            timeout: 60000,
        });
        process.on('exit', () => {
            void browser?.close();
        });
    }
    return browser;
}

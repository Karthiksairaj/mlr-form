import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto('https://linzess.p.cwcm-admp.com/savings-card', { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForTimeout(7000);
  for (const frame of page.frames()) {
    if (frame.isDetached()) continue;
    const matches = await frame.locator('iframe[src*="recaptcha"], .g-recaptcha, .grecaptcha-badge')
      .evaluateAll(elements => elements.map(element => {
        const rect = element.getBoundingClientRect();
        return { tag: element.tagName, title: element.getAttribute('title'),
          className: String(element.className).slice(0, 100),
          srcHost: (() => { try { return new URL(element.getAttribute('src') ?? '').host; } catch { return ''; } })(),
          width: rect.width, height: rect.height };
      })).catch(() => []);
    if (matches.length) console.log(JSON.stringify({ frameHost: new URL(frame.url()).host, matches }, null, 2));
  }
} finally {
  await browser.close();
}

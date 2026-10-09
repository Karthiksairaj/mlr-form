import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173');
  await page.locator('.connection.online').waitFor();
  const health = await page.request.get('http://127.0.0.1:5173/api/health');
  if (!health.ok()) throw new Error('Development API proxy failed');
  if (await page.locator('#inputMode').inputValue() !== 'excel-steps') throw new Error('Default mode is incorrect');
  await mkdir('work/react-ui-qa', { recursive: true });
  await page.screenshot({ path: 'work/react-ui-qa/desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'work/react-ui-qa/mobile.png', fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (overflow) throw new Error('Mobile layout overflows');
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('React dev server, API proxy, default mode, desktop/mobile layout, and browser runtime checks passed.');
} finally {
  await browser.close();
}

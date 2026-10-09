import { chromium } from 'playwright';
import { describe, expect, it } from 'vitest';
import { extractVisibleFields } from './field-extractor.js';
const browserDescribe = process.env.RUN_BROWSER_TESTS === 'true' ? describe : describe.skip;
browserDescribe('large conditional form discovery', () => {
  it('skips hidden branches, discovers revealed controls, and does not rewrite stable DOM markers', async () => {
    const browser = await chromium.launch({ headless: true,
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
    try {
      const page = await browser.newPage();
      await page.setContent(`<form><label for="condition">Condition</label><select id="condition"><option>A</option><option>B</option></select>
        <div id="branch" style="display:none">${Array.from({ length: 825 }, (_, i) =>
          `<label for="f${i}">Field ${i}</label><input id="f${i}" name="f${i}">`).join('')}</div></form>`);
      const start = Date.now();
      expect((await extractVisibleFields(page)).map(field => field.label)).toEqual(['Condition']);
      expect(Date.now() - start).toBeLessThan(2000);
      await page.evaluate(() => {
        (window as any).markerChanges = 0;
        new MutationObserver(records => { (window as any).markerChanges += records.length; })
          .observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-mlr-field-id', 'data-mlr-active-form'] });
      });
      await extractVisibleFields(page);
      expect(await page.evaluate(() => (window as any).markerChanges)).toBe(0);
      await page.locator('#branch').evaluate(element => { (element as HTMLElement).style.display = 'block'; });
      expect(await extractVisibleFields(page)).toHaveLength(826);
    } finally { await browser.close(); }
  }, 30000);
});

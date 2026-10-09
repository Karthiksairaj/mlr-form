import { chromium } from 'playwright';
import { describe, expect, it } from 'vitest';
import { fillFields } from './executor.js';
import { extractVisibleFields } from './field-extractor.js';
import { conformGeneratedValues, validateGeneratedValues } from './field-validation.js';

const browserDescribe = process.env.RUN_BROWSER_TESTS === 'true' ? describe : describe.skip;

browserDescribe('text form latency', () => {
  it('fills a DOB text input with a numeric pattern and passes browser validity', async () => {
    const browser = await chromium.launch({ headless: true,
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
    try {
      const page = await browser.newPage();
      await page.setContent('<form><label>Date of Birth (MM/DD/YYYY)<input name="YourDateOfBirthAD" type="text" pattern="[0-9]*" maxlength="10" required></label></form>');
      const fields = await extractVisibleFields(page);
      const normalized = conformGeneratedValues(fields, [{ fieldId: fields[0]!.id, value: '01/01/1985' }]);
      const validation = validateGeneratedValues(fields, normalized.values);
      expect(validation.errors).toEqual([]);
      await fillFields(page, fields, validation.values);
      expect(await page.locator('input').inputValue()).toBe('01011985');
      expect(await page.locator('input').evaluate((input: HTMLInputElement) => input.checkValidity())).toBe(true);
    } finally {
      await browser.close();
    }
  }, 20_000);
  it('keeps a site-filled phone value when a same-as-primary choice locks it', async () => {
    const browser = await chromium.launch({ headless: true,
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
    try {
      const page = await browser.newPage();
      await page.setContent(`<form>
        <label>Primary Phone<input type="tel" name="primaryPhone"></label>
        <label>Mobile Phone Number<input type="tel" name="mobilePhone"></label>
        <label><input type="checkbox" name="sameAsPrimary">Same as primary phone number</label>
        <script>document.querySelector('[name="sameAsPrimary"]').addEventListener('change', event => {
          const mobile = document.querySelector('[name="mobilePhone"]');
          mobile.value = event.target.checked ? document.querySelector('[name="primaryPhone"]').value : '';
          mobile.readOnly = event.target.checked;
        });</script>
      </form>`);
      const fields = await extractVisibleFields(page);
      const primary = fields.find(field => field.name === 'primaryPhone')!;
      const mobile = fields.find(field => field.name === 'mobilePhone')!;
      const copyChoice = fields.find(field => field.name === 'sameAsPrimary')!;
      await fillFields(page, [primary], new Map([[primary.id, '2025550147']]));
      await fillFields(page, [copyChoice], new Map([[copyChoice.id, 'true']]));
      expect(await page.locator('[name="mobilePhone"]').inputValue()).toBe('2025550147');
      expect(await page.locator('[name="mobilePhone"]').isEditable()).toBe(false);

      // The earlier scan and generated value are now stale. Do not retry a
      // fill on the site's readonly, already-populated input.
      await fillFields(page, [mobile], new Map([[mobile.id, '5551234567']]));
      expect(await page.locator('[name="mobilePhone"]').inputValue()).toBe('2025550147');
    } finally {
      await browser.close();
    }
  }, 20_000);

  it('fills and verifies twenty text fields without ten seconds of fixed pauses', async () => {
    const browser = await chromium.launch({ headless: true,
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
    try {
      const page = await browser.newPage();
      await page.setContent(`<form>${Array.from({ length: 20 }, (_, index) =>
        `<label>Field ${index}<input name="field${index}"></label>`).join('')}</form>`);
      const fields = await extractVisibleFields(page);
      const values = new Map(fields.map((field, index) => [field.id, `Test ${index}`]));
      const startedAt = Date.now();
      await fillFields(page, fields, values, { settleAfterEachFieldMs: 5_000 });
      const durationMs = Date.now() - startedAt;
      expect(await page.locator('input').evaluateAll(inputs => inputs.map(input => input.value)))
        .toEqual(Array.from({ length: 20 }, (_, index) => `Test ${index}`));
      console.info(`Twenty-field fill: ${durationMs}ms`);
      expect(durationMs).toBeLessThan(5_000);
    } finally {
      await browser.close();
    }
  }, 20_000);
});

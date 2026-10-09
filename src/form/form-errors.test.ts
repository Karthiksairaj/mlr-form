import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFormErrors } from './form-errors.js';

const browserDescribe = process.env.RUN_BROWSER_TESTS === 'true' ? describe : describe.skip;

browserDescribe('feedback after a form action', () => {
  let browser: Browser;
  let page: Page;
  beforeAll(async () => { browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) }); });
  beforeEach(async () => { page = await browser.newPage(); });
  afterEach(async () => { await page.close(); });
  afterAll(async () => { await browser?.close(); });

  it('finds a plain service error without including the surrounding form or hidden errors', async () => {
    await page.setContent(`<main><div><p>Your request could not be processed. Please try again later.</p></div>
      <form><label>Name<input value="Example"></label></form>
      <div role="alert" hidden>Hidden error</div></main>`);
    expect(await readFormErrors(page)).toEqual(['Your request could not be processed. Please try again later.']);
  });

  it('reads iframe validation errors and native required-field feedback', async () => {
    await page.setContent(`<label>Email<input name="email" type="email" required></label>
      <iframe srcdoc='<p role="alert">Card activation number was rejected</p>'></iframe>`);
    await page.frameLocator('iframe').getByRole('alert').waitFor();
    const errors = await readFormErrors(page);
    expect(errors).toContain('Card activation number was rejected');
    expect(errors.some(message => message.startsWith('Email: '))).toBe(true);
  });

  it('returns no inferred errors when a filled form simply stays on the page', async () => {
    await page.setContent('<form><label>Email<input type="email" required value="test@example.test"></label></form>');
    expect(await readFormErrors(page)).toEqual([]);
  });
});

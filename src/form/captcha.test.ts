import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { detectCaptcha } from './captcha.js';

const browserDescribe = process.env.RUN_BROWSER_TESTS === 'true' ? describe : describe.skip;

browserDescribe('CAPTCHA challenge detection', () => {
  let browser: Browser;
  let page: Page;
  beforeAll(async () => { browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) }); });
  beforeEach(async () => { page = await browser.newPage(); });
  afterEach(async () => { await page.close(); });
  afterAll(async () => { await browser?.close(); });

  it('does not treat a visible reCAPTCHA mount or badge as a blocking challenge', async () => {
    await page.setContent('<div class="g-recaptcha" style="width:180px;height:40px">Protected by reCAPTCHA</div>');
    expect(await detectCaptcha(page)).toEqual({ detected: true, provider: 'reCAPTCHA', blocking: false });
  });

  it('blocks only when a challenge frame is visible', async () => {
    await page.setContent('<div class="g-recaptcha"></div><iframe title="reCAPTCHA challenge" srcdoc="Verify you are human"></iframe>');
    expect(await detectCaptcha(page)).toEqual({ detected: true, provider: 'reCAPTCHA', blocking: true });
    await page.locator('iframe').evaluate(frame => (frame as HTMLElement).style.display = 'none');
    expect(await detectCaptcha(page)).toEqual({ detected: true, provider: 'reCAPTCHA', blocking: false });
  });
});

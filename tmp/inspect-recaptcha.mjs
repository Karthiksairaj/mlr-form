import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto('https://linzess.p.cwcm-admp.com/savings-card', { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForTimeout(7000);
  const urls = await page.evaluate(() => [...document.scripts].map(script => script.src).filter(Boolean));
  for (const url of urls.filter(url => /formscustomfunctions/iu.test(url))) {
    const response = await page.request.get(url).catch(() => undefined);
    if (!response?.ok()) continue;
    const code = await response.text();
    const markers = ['Enterprise reCAPTCHA support for AJAX form submissions',
      'function fetchObservabilityAndSubmit', 'function viberziSubmitAction',
      'function getEnterpriseCaptchaToken'];
    for (const marker of markers) {
      const at = code.indexOf(marker);
      if (at >= 0) console.log(JSON.stringify({ marker, snippet: code.slice(at, at + 2500) }));
    }
  }
} finally {
  await browser.close();
}

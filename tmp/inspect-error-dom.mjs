import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto('https://linzess.p.cwcm-admp.com/savings-card', { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForTimeout(7000);
  for (const frame of page.frames()) {
    if (frame.isDetached()) continue;
    const matches = await frame.evaluate(() => {
      const pattern = /your request could not be processed|please try again later/iu;
      const items = [];
      for (const element of document.querySelectorAll('body *')) {
        const ownText = [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE)
          .map(node => node.textContent ?? '').join(' ').trim();
        const before = getComputedStyle(element, '::before').content;
        const after = getComputedStyle(element, '::after').content;
        if (!pattern.test(ownText) && !pattern.test(before) && !pattern.test(after)) continue;
        const style = getComputedStyle(element);
        items.push({ tag: element.tagName, id: element.id, className: String(element.className).slice(0, 120),
          ownText: ownText.slice(0, 150), before: before.slice(0, 150), after: after.slice(0, 150),
          display: style.display, visibility: style.visibility, rects: element.getClientRects().length });
      }
      return items.slice(0, 10);
    }).catch(() => []);
    if (matches.length) console.log(JSON.stringify({ frame: frame.url(), matches }, null, 2));
  }
} finally {
  await browser.close();
}

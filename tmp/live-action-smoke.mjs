import { chromium } from 'playwright';
import { extractVisibleFields, waitForStableFormFields } from '../src/form/field-extractor.ts';
import { discoverFormActions } from '../src/form/action-discovery.ts';

process.env.PLAYWRIGHT_BROWSERS_PATH ||= 'work/playwright-browsers';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto('https://linzess.p.cwcm-admp.com/savings-card', { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await waitForStableFormFields(page, { timeoutMs: 30_000, minimumWaitMs: 5_000 });
  const fields = await extractVisibleFields(page);
  const actions = await discoverFormActions(page, fields);
  console.log(JSON.stringify({ fieldCount: fields.length, actions: actions.map(({ id, label, kind }) => ({ id, label, kind })) }, null, 2));
} finally {
  await browser.close();
}

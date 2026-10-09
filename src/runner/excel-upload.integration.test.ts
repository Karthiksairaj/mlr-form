import ExcelJS from 'exceljs';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { RunStore } from '../storage/run-store.js';
import { JobQueue } from '../queue/job-queue.js';
import { DeterministicDataGenerator } from '../form/deterministic-data-generator.js';
import { FormRunner } from './form-runner.js';

const browserDescribe = process.env.RUN_BROWSER_TESTS === 'true' ? describe : describe.skip;

browserDescribe('Excel upload through the UI', () => {
  it('uses Excel identifiers across steps and generates missing data', async () => {
    const store = new RunStore(path.resolve('work/excel-upload-test'));
    await store.initialize();
    const generator = new DeterministicDataGenerator();
    const runner = new FormRunner(store, generator, { allowedTargetHosts: new Set(['127.0.0.1']),
      allowPrivateNetworks: true, headless: true, timeoutMs: 60_000, formReadyTimeoutMs: 1500 });
    const app = await buildApp({ store, runner, queue: new JobQueue(1), allowedTargetHosts: new Set(['127.0.0.1']),
      allowPrivateNetworks: true, maxSteps: 5, dataGenerator: generator });
    let submitted: unknown;
    app.post('/payload-check', async request => { submitted = request.body; return { ok: true }; });
    app.get('/payload-fixture', async (_request, reply) => reply.type('text/html').send(`<!doctype html><html><body>
      <form><section id="first"><label>NPI Number<input name="npi" pattern="[0-9]{10}" required></label>
      <button type="button" id="next">Continue</button></section><section id="second" hidden>
      <label>Card Activation Number<input name="cardActivationNumber" required disabled></label>
      <label>Email<input name="email" type="email" required disabled></label><button type="submit" disabled>Submit</button>
      </section></form><script>
      document.querySelector('#next').onclick = () => {
        document.querySelector('#first').hidden = true;
        document.querySelector('#second').hidden = false;
        document.querySelectorAll('[disabled]').forEach(el => el.disabled = false);
      };
      document.querySelector('form').onsubmit = async event => {
        event.preventDefault();
        await fetch('/payload-check', { method: 'POST', headers: {'content-type':'application/json'},
          body: JSON.stringify(Object.fromEntries(new FormData(event.target))) });
        document.body.innerHTML = '<h1>Thank you for registering</h1>';
      };
      </script></body></html>`));
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    const browser = await chromium.launch({ headless: true,
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.addWorksheet('Payload').addRows([
        ['Field', 'Value'], ['npi', '0012345678'], ['cardActivationNumber', '000000012345678901']
      ]);
      const page = await browser.newPage();
      await page.goto(address);
      await page.locator('#inputMode').selectOption('automatic');
      await page.locator('#url').fill(`${address}/payload-fixture`);
      await page.locator('#payloadExcel').setInputFiles({ name: 'data.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: Buffer.from(await workbook.xlsx.writeBuffer()) });
      await page.locator('#submit').check();
      await page.locator('summary').click();
      await page.locator('#textContains').fill('Thank you for registering');
      await page.screenshot({ path: path.resolve('work/excel-upload-test/upload-ui.png'), fullPage: true });
      await page.locator('#start').click();
      await page.waitForFunction(() => document.querySelector('#status')?.textContent === 'Passed', { }, { timeout: 60_000 });
      expect(submitted).toEqual({ npi: '0012345678', cardActivationNumber: '000000012345678901', email: 'form.test@abbvie.com' });
      const runId = await page.locator('#run-id').innerText();
      const status = await app.inject({ method: 'GET', url: `/v1/form-runs/${runId}` });
      expect(status.json().request.payload).toBeUndefined();
      expect(JSON.parse(await readFile(store.artifactPath(runId, 'run.json'), 'utf8')).request.payload).toBeUndefined();
      const invalid = await app.inject({ method: 'POST', url: '/v1/form-runs', payload: {
        url: `${address}/payload-fixture`, scenario: 'basic', payloadExcel: { filename: 'invalid.xlsx', base64: 'YWJj' }
      } });
      expect(invalid.statusCode).toBe(400);
      expect(invalid.json().error).toBe('invalid_excel_payload');
    } finally {
      await browser.close();
      await app.close();
    }
  }, 90_000);
});

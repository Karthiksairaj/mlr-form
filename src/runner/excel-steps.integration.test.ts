import ExcelJS from 'exceljs';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { chromium, type Browser } from 'playwright';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { RunStore } from '../storage/run-store.js';
import { JobQueue } from '../queue/job-queue.js';
import { DeterministicDataGenerator } from '../form/deterministic-data-generator.js';
import { FormRunner } from './form-runner.js';

const browserDescribe = process.env.RUN_BROWSER_TESTS === 'true' ? describe : describe.skip;
const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

browserDescribe('Excel for each page', () => {
  it('waits for each upload, retains the browser session, and permits backend rejection retries', async () => {
    const store = new RunStore(path.resolve('work/excel-upload-test'));
    await store.initialize();
    const generator = new DeterministicDataGenerator();
    const runner = new FormRunner(store, generator, { allowedTargetHosts: new Set(['127.0.0.1']),
      allowPrivateNetworks: true, headless: true, timeoutMs: 120_000, formReadyTimeoutMs: 1500 });
    const app = await buildApp({ store, runner, queue: new JobQueue(1), allowedTargetHosts: new Set(['127.0.0.1']),
      allowPrivateNetworks: true, maxSteps: 5, dataGenerator: generator });
    const received: Array<Record<string, string>> = [];
    app.get('/guided-one', async (_request, reply) => reply.type('text/html').send(`<!doctype html><html><body>
      <form><label>NPI Number<input name="npi" required pattern="[0-9]{10}"></label><button>Continue</button></form>
      <script>document.querySelector('form').onsubmit = async event => {
        event.preventDefault(); await fetch('/guided-first', { method:'POST', headers:{'content-type':'application/json'},
          body:JSON.stringify(Object.fromEntries(new FormData(event.target))) }); location.href='/guided-two';
      };</script></body></html>`));
    app.post('/guided-first', async (request, reply) => {
      received.push(request.body as Record<string, string>);
      return reply.header('set-cookie', 'guidedSession=retained; Path=/; HttpOnly').send({ ok: true });
    });
    app.get('/guided-two', async (request, reply) => {
      if (!request.headers.cookie?.includes('guidedSession=retained')) return reply.code(403).send('Session missing');
      return reply.type('text/html').send(`<!doctype html><html><body>
        <form><label>Card Activation Number<input name="card" required></label>
        <label>Email<input name="email" type="email" required></label><button>Submit</button></form><p role="alert"></p>
        <script>document.querySelector('form').onsubmit = async event => {
          event.preventDefault(); const response = await fetch('/guided-final', { method:'POST', headers:{'content-type':'application/json'},
            body:JSON.stringify(Object.fromEntries(new FormData(event.target))) });
          if(response.ok) document.body.innerHTML='<h1>Thank you for registering</h1>';
          else document.querySelector('[role=alert]').textContent='Card activation number was rejected';
        };</script></body></html>`);
    });
    app.post('/guided-final', async (request, reply) => {
      const body = request.body as Record<string, string>;
      received.push(body);
      return body.card === '000001234567890123' ? { ok: true } : reply.code(400).send({ error: 'invalid_card' });
    });
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    let browser: Browser | undefined;
    try {
      browser = await chromium.launch({ headless: true,
        ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
      const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
      await page.goto(address);
      await page.locator('#url').fill(`${address}/guided-one`);
      await page.locator('#submit').check();
      await page.locator('#start').click();
      await page.locator('#step-input:not(.hidden)').waitFor();
      expect(received).toHaveLength(0);
      const runId = await page.locator('#run-id').innerText();
      const firstState = (await app.inject(`/v1/form-runs/${runId}`)).json();
      expect(firstState.status).toBe('awaiting_input');
      expect(firstState.currentStep).toBe(1);
      const download = page.waitForEvent('download');
      await page.locator('#download-step').click();
      const downloadPath = await (await download).path();
      const first = new ExcelJS.Workbook();
      await first.xlsx.load(Uint8Array.from(await readFile(downloadPath!)).buffer);
      expect(first.getWorksheet('Payload')!.getCell('C2').value).toBe('NPI Number');
      const blank = Buffer.from(await first.xlsx.writeBuffer());
      await page.locator('#stepExcel').setInputFiles({ name: 'page-one.xlsx', mimeType, buffer: blank });
      await page.locator('#upload-step').click();
      await page.waitForFunction(() => document.querySelector('#input-error')?.textContent?.includes('required'));
      expect(received).toHaveLength(0);
      first.getWorksheet('Payload')!.getCell('B2').value = '0012345678';
      const firstFilled = Buffer.from(await first.xlsx.writeBuffer());
      await page.locator('#stepExcel').setInputFiles({ name: 'page-one.xlsx', mimeType, buffer: firstFilled });
      await page.locator('#upload-step').click();
      await page.waitForFunction(() => document.querySelector('#input-title')?.textContent === 'Excel for page 2', {}, { timeout: 30_000 });
      expect(received).toEqual([{ npi: '0012345678' }]);
      const secondState = (await app.inject(`/v1/form-runs/${runId}`)).json();
      expect(secondState.inputRequest.token).not.toBe(firstState.inputRequest.token);
      // A UI refresh resumes the same waiting browser session.
      await page.reload();
      await page.locator('#step-input:not(.hidden)').waitFor();
      expect(await page.locator('#run-id').innerText()).toBe(runId);
      expect(await page.locator('#url').inputValue()).toBe(`${address}/guided-one`);
      expect(await page.locator('#submit').isChecked()).toBe(true);
      await page.locator('#stepExcel').setInputFiles({ name: 'wrong-page.xlsx', mimeType, buffer: firstFilled });
      await page.locator('#upload-step').click();
      await page.waitForFunction(() => document.querySelector('#input-error')?.textContent?.includes('another step'));
      const secondDownload = await app.inject(secondState.inputRequest.downloadUrl);
      const second = new ExcelJS.Workbook();
      await second.xlsx.load(Uint8Array.from(secondDownload.rawPayload).buffer);
      expect(second.getWorksheet('Payload')!.getColumn(3).values).toContain('Card Activation Number');
      const sheet = second.getWorksheet('Payload')!;
      sheet.getCell('B2').value = 'rejected-card';
      sheet.getCell('B3').value = 'test@example.test';
      await page.locator('#stepExcel').setInputFiles({ name: 'page-two.xlsx', mimeType, buffer: Buffer.from(await second.xlsx.writeBuffer()) });
      await page.locator('#upload-step').click();
      await page.waitForFunction(() => document.querySelector('#input-message')?.textContent?.includes('stayed on this page'), {}, { timeout: 30_000 });
      expect(received).toHaveLength(2);
      const retryState = (await app.inject(`/v1/form-runs/${runId}`)).json();
      expect(retryState.inputRequest.token).toBe(secondState.inputRequest.token);
      expect(retryState.inputRequest.message).toContain('Card activation number was rejected');
      await page.screenshot({ path: path.resolve('work/excel-upload-test/guided-ui.png'), fullPage: true });
      sheet.getCell('B2').value = '000001234567890123';
      await page.locator('#stepExcel').setInputFiles({ name: 'page-two.xlsx', mimeType, buffer: Buffer.from(await second.xlsx.writeBuffer()) });
      await page.locator('#upload-step').click();
      await page.waitForFunction(() => document.querySelector('#status')?.textContent === 'Passed', {}, { timeout: 30_000 });
      expect(received.at(-1)).toEqual({ card: '000001234567890123', email: 'test@example.test' });
      expect(store.get(runId)?.dataGeneration?.requests).toBe(0);
      expect(store.get(runId)?.inputRequest).toBeUndefined();
      expect(store.get(runId)?.steps.map(step => step.status)).toEqual(['completed', 'completed']);
    } finally {
      await browser?.close();
      await app.close();
    }
  }, 120_000);
});

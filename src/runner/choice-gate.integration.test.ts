import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { describe, expect, it, vi } from 'vitest';
import { DeterministicDataGenerator } from '../form/deterministic-data-generator.js';
import { RunStore } from '../storage/run-store.js';
import { FormRunner } from './form-runner.js';

const browserDescribe = process.env.RUN_BROWSER_TESTS === 'true' ? describe : describe.skip;

browserDescribe('initial form choice', () => {
  it.each([
    { choice: 'Atopic dermatitis', expectedField: 'Patient Email' },
    { choice: 'Rheumatoid arthritis', expectedField: 'Card Activation Number' }
  ])('offers $choice before creating the first workbook', async ({ choice, expectedField }) => {
    const server = createServer((request, response) => {
      if (request.url === '/slow.js') {
        // The chooser is visible before its deferred initialization script.
        // Selecting it before the handler attaches silently loses the choice.
        const timer = setTimeout(() => {
          response.writeHead(200, { 'content-type': 'text/javascript' });
          response.end(`document.querySelector('#condition').addEventListener('change', event => {
            const selected = event.target.value;
            setTimeout(() => {
              document.querySelector('#destination').innerHTML = selected === 'ad'
                ? '<form><label>Patient Email<input name="patientEmail" type="email" required></label><button type="submit">Submit</button></form>'
                : '<form><label>Card Activation Number<input name="cardNumber" required></label><button type="submit">Submit</button></form>';
            }, 6000);
          });`);
        }, 6_000);
        response.on('close', () => clearTimeout(timer));
        return;
      }
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end(`<!doctype html><script defer src="/slow.js"></script><label for="condition">Select a condition</label>
        <select id="condition" name="condition"><option value="">Choose a condition</option>
          <option value="ad">Atopic dermatitis</option><option value="ra">Rheumatoid arthritis</option></select>
        <div id="destination"></div>`);
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Fixture server unavailable');
    const store = new RunStore(path.resolve('work/excel-upload-test/choice-gate'));
    await store.initialize();
    const runner = new FormRunner(store, new DeterministicDataGenerator(), {
      allowedTargetHosts: new Set(['127.0.0.1']), allowPrivateNetworks: true,
      headless: true, timeoutMs: 45_000, formReadyTimeoutMs: 2_000,
      initialFormReadyTimeoutMs: 10_000
    });
    // Reproduce a ready form whose optional preview cannot render. The
    // workbook must still be offered; confirmation screenshots remain required.
    const preview = choice === 'Atopic dermatitis'
      ? vi.spyOn(runner as unknown as { captureBuffer: (...args: unknown[]) => Promise<Buffer> }, 'captureBuffer')
        .mockRejectedValueOnce(new Error('page.screenshot: Timeout 5000ms exceeded.'))
      : undefined;
    const captchaInspection = vi.spyOn(runner as unknown as {
      inspectCaptcha: (...args: unknown[]) => Promise<unknown>
    }, 'inspectCaptcha');
    const id = randomUUID();
    const now = new Date().toISOString();
    await store.create({ id, request: { url: `http://127.0.0.1:${address.port}/gate`,
      scenario: 'generic-form', submit: false, maxSteps: 3, inputMode: 'excel-steps' },
    status: 'queued', createdAt: now, updatedAt: now, currentStep: 0,
    formDetected: false, steps: [], artifacts: [], captcha: { detected: false } });
    const run = runner.run(id);
    try {
      await expect.poll(() => store.get(id)?.inputRequest?.kind, { timeout: 20_000 }).toBe('choice');
      const gate = store.get(id)!;
      // Offering a route must not wait for an unrelated whole-page CAPTCHA
      // scan. Submission performs that inspection separately.
      expect(captchaInspection).not.toHaveBeenCalled();
      expect(gate.currentStep).toBe(0);
      expect(gate.steps).toHaveLength(0);
      expect(gate.artifacts).toHaveLength(0);
      const chosen = gate.inputRequest!.actions!.find(action => action.label === choice)!;
      expect(chosen.kind).toBe('next');
      expect(() => runner.stepInput.download(id, gate.inputRequest!.token)).toThrow(/choosing an option/iu);
      await runner.stepInput.upload(id, gate.inputRequest!.token, undefined, false, chosen.id);

      await expect.poll(() => store.get(id)?.inputRequest?.kind, { timeout: 15_000 }).toBe('fields');
      const form = store.get(id)!;
      if (preview) {
        expect(preview).toHaveBeenCalledWith(expect.anything(), id, 5_000);
        expect(form.artifacts).toHaveLength(0);
      }
      expect(form.currentStep).toBe(1);
      expect(form.steps).toHaveLength(1);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Uint8Array.from(runner.stepInput.download(id, form.inputRequest!.token)).buffer);
      expect(workbook.getWorksheet('Payload')!.getColumn(3).values).toContain(expectedField);
      expect(workbook.getWorksheet('Payload')!.getColumn(3).values).not.toContain('Select a condition');
      runner.stepInput.cancel(id);
      await run;
    } finally {
      preview?.mockRestore();
      captchaInspection.mockRestore();
      await runner.close();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  }, 45_000);
});

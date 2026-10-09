import ExcelJS from 'exceljs';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import { chromium, type Browser } from 'playwright';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { RunStore } from '../storage/run-store.js';
import { JobQueue } from '../queue/job-queue.js';
import { DeterministicDataGenerator } from '../form/deterministic-data-generator.js';
import type { RunRecord } from '../types.js';
import { FormRunner } from './form-runner.js';

const browserDescribe = process.env.RUN_BROWSER_TESTS === 'true' ? describe : describe.skip;
type InputRequest = NonNullable<RunRecord['inputRequest']>;

async function waitForInput(store: RunStore, runId: string, previousToken?: string): Promise<InputRequest> {
  await expect.poll(() => {
    const run = store.get(runId);
    if (run && ['failed', 'blocked', 'inconclusive'].includes(run.status)) {
      return `${run.status}: ${run.error?.message}`;
    }
    return run?.status === 'awaiting_input' && run.inputRequest?.token !== previousToken ? 'ready' : 'waiting';
  }, { timeout: 30_000, interval: 100 }).toBe('ready');
  return store.get(runId)!.inputRequest!;
}

async function workbookFor(app: FastifyInstance, input: InputRequest): Promise<ExcelJS.Workbook> {
  const response = await app.inject(input.downloadUrl);
  expect(response.statusCode).toBe(200);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Uint8Array.from(response.rawPayload).buffer);
  return workbook;
}

function labels(workbook: ExcelJS.Workbook): string[] {
  const sheet = workbook.getWorksheet('Payload')!;
  return Array.from({ length: sheet.rowCount - 1 }, (_, index) => String(sheet.getCell(index + 2, 3).value));
}

async function uploadValues(app: FastifyInstance, runId: string, input: InputRequest,
  workbook: ExcelJS.Workbook, values: Record<string, string>): Promise<void> {
  const sheet = workbook.getWorksheet('Payload')!;
  for (let row = 2; row <= sheet.rowCount; row += 1) {
    const label = String(sheet.getCell(row, 3).value);
    expect(values, `No test answer provided for ${label}`).toHaveProperty(label);
    sheet.getCell(row, 2).value = values[label]!;
  }
  const response = await app.inject({ method: 'POST', url: `/v1/form-runs/${runId}/input/${input.token}`, payload: {
    payloadExcel: { filename: 'filled.xlsx', base64: Buffer.from(await workbook.xlsx.writeBuffer()).toString('base64') }
  } });
  expect(response.statusCode, response.body).toBe(202);
}

browserDescribe('conditional fields and selected card flows', () => {
  it.each([
    { label: 'Get New Card', route: 'newCard', fieldLabel: 'Email for New Card', field: 'newCardEmail', value: 'regression@example.test', submit: true },
    { label: 'Activate Existing Card', route: 'activate', fieldLabel: 'Card Activation Number', field: 'activationNumber', value: '000001234567890123', submit: true },
    { label: 'Activate Existing Card', route: 'activate', fieldLabel: 'Card Activation Number', field: 'activationNumber', value: '000001234567890123', submit: false }
  ])('keeps additions on page 1 and handles $label with submission enabled: $submit', async flow => {
    const store = new RunStore(path.resolve('work/excel-upload-test/conditional'));
    await store.initialize();
    const generator = new DeterministicDataGenerator();
    const runner = new FormRunner(store, generator, { allowedTargetHosts: new Set(['127.0.0.1']),
      allowPrivateNetworks: true, headless: true, timeoutMs: 120_000, formReadyTimeoutMs: 1500 });
    const app = await buildApp({ store, runner, queue: new JobQueue(1), allowedTargetHosts: new Set(['127.0.0.1']),
      allowPrivateNetworks: true, maxSteps: 5, dataGenerator: generator });
    const registrations: Array<{ route: string; values: Record<string, string> }> = [];
    const completions: Array<{ route: string; values: Record<string, string> }> = [];
    app.post('/conditional-register', async request => {
      registrations.push(request.body as typeof registrations[number]);
      return { ok: true };
    });
    app.post('/conditional-complete', async request => {
      completions.push(request.body as typeof completions[number]);
      return { ok: true };
    });
    app.get('/conditional-card', async (_request, reply) => reply.type('text/html').send(`<!doctype html><html><body>
      <main id="form-root"><form id="registration" class="cmp-adaptiveform-container">
        <label>Name<input name="personName" required></label>
        <label><input type="checkbox" name="taking" value="yes">Currently taking</label>
        <label><input type="checkbox" name="marketing" value="yes">Marketing consent</label>
        <button type="button" class="cmp-adaptiveform-button__widget submit" data-route="newCard">Get New Card</button>
        <button type="button" class="cmp-adaptiveform-button__widget" data-route="activate">Activate Existing Card</button>
      </form></main>
      <script>
        const form = document.querySelector('#registration');
        form.querySelector('[name=taking]').addEventListener('change', event => {
          if (event.target.checked && !form.querySelector('[name=duration]')) {
            form.insertAdjacentHTML('afterbegin', '<div><label for="duration">Treatment duration</label><select id="duration" name="duration" required><option value="">Please select</option><option value="recent">Less than 2 weeks</option><option value="longer">2 weeks or longer</option></select></div>');
          }
        });
        form.querySelector('[name=marketing]').addEventListener('change', event => {
          if (event.target.checked && !form.querySelector('[name=sms]')) {
            form.insertAdjacentHTML('afterbegin', '<label><input type="checkbox" name="sms" value="yes">SMS consent</label>');
          }
        });
        for (const button of form.querySelectorAll('button[data-route]')) {
          button.addEventListener('click', async () => {
            if (!form.reportValidity()) return;
            const route = button.dataset.route;
            await fetch('/conditional-register', { method: 'POST', headers: {'content-type':'application/json'},
              body: JSON.stringify({route, values: Object.fromEntries(new FormData(form))}) });
            const details = route === 'newCard'
              ? '<label>Email for New Card<input name="newCardEmail" type="email" required></label>'
              : '<label>Card Activation Number<input name="activationNumber" required></label>';
            document.querySelector('#form-root').innerHTML = '<form id="card-details">' + details + '<button type="submit">Submit</button></form>';
            document.querySelector('#card-details').addEventListener('submit', async event => {
              event.preventDefault();
              await fetch('/conditional-complete', { method: 'POST', headers: {'content-type':'application/json'},
                body: JSON.stringify({route, values: Object.fromEntries(new FormData(event.target))}) });
              document.querySelector('#form-root').innerHTML = '<h1>Thank you for registering</h1>';
            });
          });
        }
      </script></body></html>`));
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    let browser: Browser | undefined;
    try {
      browser = await chromium.launch({ headless: true,
        ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
      const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
      await page.goto(address);
      await page.locator('#url').fill(`${address}/conditional-card`);
      if (flow.submit) await page.locator('#submit').check();
      await page.locator('#start').click();
      await page.locator('#step-input:not(.hidden)').waitFor();
      const runId = await page.locator('#run-id').innerText();
      const firstInput = await waitForInput(store, runId);
      const initial = await workbookFor(app, firstInput);
      expect(labels(initial)).toEqual(['Name', 'Currently taking', 'Marketing consent']);
      await uploadValues(app, runId, firstInput, initial, {
        Name: 'Regression Tester', 'Currently taking': 'true', 'Marketing consent': 'true'
      });

      const additionalInput = await waitForInput(store, runId, firstInput.token);
      expect(additionalInput.kind).toBe('fields');
      expect(additionalInput.step).toBe(1);
      expect(store.get(runId)!.currentStep).toBe(1);
      expect(store.get(runId)!.steps).toHaveLength(1);
      const additional = await workbookFor(app, additionalInput);
      // Both reveals insert ahead of existing controls, changing their extraction indices.
      expect(labels(additional).sort()).toEqual(['SMS consent', 'Treatment duration']);
      expect(registrations).toHaveLength(0);
      await uploadValues(app, runId, additionalInput, additional, { 'Treatment duration': 'recent', 'SMS consent': 'true' });

      const actionInput = await waitForInput(store, runId, additionalInput.token);
      expect(actionInput.kind).toBe('action');
      expect(actionInput.step).toBe(1);
      expect(actionInput.actions?.map(action => ({ label: action.label, kind: action.kind }))).toEqual([
        { label: 'Get New Card', kind: 'submit' }, { label: 'Activate Existing Card', kind: 'submit' }
      ]);
      expect(registrations).toHaveLength(0);
      // The action UI uses the discovered labels and sends actionId without a workbook.
      await page.locator('#next-action').waitFor();
      expect(await page.locator('#download-step').count()).toBe(0);
      expect(await page.locator('#stepExcel').count()).toBe(0);
      await page.locator('#next-action').selectOption({ label: flow.label });
      expect(await page.locator('#upload-step').innerText()).toContain('Continue with selected action');
      if (!flow.submit) {
        const denied = await app.inject({ method: 'POST', url: `/v1/form-runs/${runId}/input/${actionInput.token}`,
          payload: { actionId: actionInput.actions!.find(action => action.label === flow.label)!.id } });
        expect(denied.statusCode).toBe(400);
        expect(store.get(runId)?.status).toBe('awaiting_input');
        expect(registrations).toHaveLength(0);
        await page.locator('#authorize-action-submit').check();
      }
      if (flow.route === 'activate' && flow.submit) {
        await mkdir(path.resolve('work/react-ui-qa'), { recursive: true });
        await page.screenshot({ path: path.resolve('work/react-ui-qa/conditional-action-choice.png'), fullPage: true });
      }
      const actionRequest = page.waitForRequest(request => request.method() === 'POST' &&
        request.url().endsWith(`/input/${actionInput.token}`));
      await page.locator('#upload-step').click();
      const actionBody = (await actionRequest).postDataJSON();
      expect(actionBody).toEqual({ actionId: actionInput.actions!.find(action => action.label === flow.label)!.id,
        useAI: false, ...(!flow.submit ? { authorizeSubmit: true } : {}) });

      const secondInput = await waitForInput(store, runId, actionInput.token);
      expect(secondInput.kind).toBe('fields');
      expect(secondInput.step).toBe(2);
      expect(secondInput.pageUrl).toBe(`${address}/conditional-card`);
      expect(store.get(runId)!.currentStep).toBe(2);
      expect(store.get(runId)!.steps[0]?.submissionAuthorized).toBe(true);
      expect(registrations).toEqual([{ route: flow.route, values: {
        personName: 'Regression Tester', taking: 'yes', marketing: 'yes', duration: 'recent', sms: 'yes'
      } }]);
      const second = await workbookFor(app, secondInput);
      expect(labels(second)).toEqual([flow.fieldLabel]);
      if (!flow.submit) {
        expect(store.get(runId)!.request.submit).toBe(false);
        expect(registrations).toHaveLength(1);
      }
      await uploadValues(app, runId, secondInput, second, { [flow.fieldLabel]: flow.value });
      if (!flow.submit) {
        const finalChoice = await waitForInput(store, runId, secondInput.token);
        expect(finalChoice.kind).toBe('action');
        expect(finalChoice.actions?.map(action => action.label)).toEqual(['Submit']);
        const submitActionId = finalChoice.actions![0]!.id;
        const denied = await app.inject({ method: 'POST', url: `/v1/form-runs/${runId}/input/${finalChoice.token}`,
          payload: { actionId: submitActionId } });
        expect(denied.statusCode).toBe(400);
        const approved = await app.inject({ method: 'POST', url: `/v1/form-runs/${runId}/input/${finalChoice.token}`,
          payload: { actionId: submitActionId, authorizeSubmit: true } });
        expect(approved.statusCode, approved.body).toBe(202);
      }
      await expect.poll(() => store.get(runId)?.status, { timeout: 30_000, interval: 100 }).toBe('passed');
      expect(completions).toEqual([{ route: flow.route, values: { [flow.field]: flow.value } }]);
      expect(store.get(runId)!.steps.map(step => step.status)).toEqual(['completed', 'completed']);
      expect(store.get(runId)!.dataGeneration?.requests).toBe(0);
      expect(store.get(runId)!.inputRequest).toBeUndefined();
    } finally {
      await browser?.close();
      await app.close();
    }
  }, 120_000);
});

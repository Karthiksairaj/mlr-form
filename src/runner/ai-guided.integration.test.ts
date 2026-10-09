import path from 'node:path';
import { chromium } from 'playwright';
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';
import { RunStore } from '../storage/run-store.js';
import { JobQueue } from '../queue/job-queue.js';
import { DeterministicDataGenerator } from '../form/deterministic-data-generator.js';
import { FormRunner } from './form-runner.js';

const browserDescribe = process.env.RUN_BROWSER_TESTS === 'true' ? describe : describe.skip;
browserDescribe('AI with direct conditional inputs', () => {
  it('asks only for a final radio that changes the form after ordinary Medicare questions', async () => {
    const store = new RunStore(path.resolve('work/ai-guided-final-radio-test')); await store.initialize();
    const generator = new DeterministicDataGenerator();
    const runner = new FormRunner(store, generator, { allowedTargetHosts: new Set(['127.0.0.1']),
      allowPrivateNetworks: true, headless: true, timeoutMs: 90000, formReadyTimeoutMs: 1500 });
    const app = await buildApp({ store, runner, queue: new JobQueue(1), allowedTargetHosts: new Set(['127.0.0.1']),
      allowPrivateNetworks: true, maxSteps: 4, dataGenerator: generator });
    const submitted: Record<string, string>[] = [];
    app.get('/three-radios', async (_request, reply) => reply.type('text/html').send(`<!doctype html><form>
      <fieldset><legend>Are you enrolled in Medicare or Medicaid?</legend>
        <label><input type="radio" name="medicare" value="yes">Yes</label>
        <label><input type="radio" name="medicare" value="no">No</label></fieldset>
      <fieldset><legend>Are you Medicare-eligible and enrolled in an employer-sponsored plan?</legend>
        <label><input type="radio" name="retiree" value="yes">Yes</label>
        <label><input type="radio" name="retiree" value="no">No</label></fieldset>
      <fieldset><legend>Are you a resident of the United States or Puerto Rico?</legend>
        <label><input type="radio" name="resident" value="yes">Yes</label>
        <label><input type="radio" name="resident" value="no">No</label></fieldset>
      <div id="branch"></div><button>Submit</button></form>
      <script>let revealTimer;
      document.querySelectorAll('[name=resident]').forEach(input => input.addEventListener('change', () => {
        clearTimeout(revealTimer); document.querySelector('#branch').innerHTML = '';
        if (input.value === 'yes') revealTimer = setTimeout(() => {
          document.querySelector('#branch').innerHTML = '<label>State<select name="state" required>' +
            '<option value="">Please Select</option><option value="NY">New York</option></select></label>';
        }, 2500);
      }));
      document.querySelector('form').onsubmit = async event => {event.preventDefault();
        await fetch('/three-radios-submit',{method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify(Object.fromEntries(new FormData(event.target)))});
        document.body.innerHTML='<h1>Thank you for your answers</h1>';
      };</script>`));
    app.post('/three-radios-submit', async request => { submitted.push(request.body as Record<string, string>); return { ok: true }; });
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
    try {
      const page = await browser.newPage(); await page.goto(address);
      await page.locator('#inputMode').selectOption('ai-guided');
      await page.locator('#url').fill(`${address}/three-radios`);
      await page.locator('#submit').check(); await page.locator('#start').click();
      const resident = page.getByRole('group', { name: 'Are you a resident of the United States or Puerto Rico?' });
      await resident.getByRole('radio', { name: 'Yes' }).waitFor({ timeout: 30000 });
      const id = await page.locator('#run-id').innerText();
      expect(store.get(id)?.inputRequest?.fields?.map(field => field.name)).toEqual(['resident', 'resident']);
      expect(await page.getByRole('group', { name: 'Are you enrolled in Medicare or Medicaid?' }).count()).toBe(0);
      expect(await page.getByRole('group', { name: 'Are you Medicare-eligible and enrolled in an employer-sponsored plan?' }).count()).toBe(0);
      await resident.getByRole('radio', { name: 'Yes' }).check();
      await page.locator('#upload-step').click();
      await expect.poll(() => store.get(id)?.status, { timeout: 30000 }).toBe('passed');
      expect(submitted[0]).toMatchObject({ medicare: 'yes', retiree: 'yes', resident: 'yes', state: 'NY' });
    } finally { await browser.close(); await runner.close(); await app.close(); }
  }, 90000);

  it('fills required multi-select quiz checkboxes with AI and follows the next revealed question', async () => {
    const store = new RunStore(path.resolve('work/ai-guided-checkbox-test')); await store.initialize();
    const generator = new DeterministicDataGenerator();
    const runner = new FormRunner(store, generator, { allowedTargetHosts: new Set(['127.0.0.1']),
      allowPrivateNetworks: true, headless: true, timeoutMs: 90000, formReadyTimeoutMs: 1500 });
    const app = await buildApp({ store, runner, queue: new JobQueue(1), allowedTargetHosts: new Set(['127.0.0.1']),
      allowPrivateNetworks: true, maxSteps: 4, dataGenerator: generator });
    const submitted: Record<string, string>[] = [];
    app.get('/checkbox-quiz', async (_request, reply) => reply.type('text/html').send(`<!doctype html>
      <style>.cmp-adaptiveform-checkboxgroup__option__widget{width:0;height:0;opacity:0;position:absolute}
        .cmp-adaptiveform-checkboxgroup__option-label{display:inline-block;padding:10px}</style>
      <form><p>Which symptoms have you experienced?</p><div><div class="cmp-adaptiveform-checkboxgroup" required data-cmp-required="true">
        <label class="cmp-adaptiveform-checkboxgroup__option-label"><input class="cmp-adaptiveform-checkboxgroup__option__widget" type="checkbox" name="symptoms" value="constipation">Constipation</label>
        <label class="cmp-adaptiveform-checkboxgroup__option-label"><input class="cmp-adaptiveform-checkboxgroup__option__widget" type="checkbox" name="symptoms" value="bloating">Bloating</label>
      </div></div><p>How have you been trying to manage your symptoms?</p><div><div class="cmp-adaptiveform-checkboxgroup" required data-cmp-required="true">
        <label class="cmp-adaptiveform-checkboxgroup__option-label"><input class="cmp-adaptiveform-checkboxgroup__option__widget" type="checkbox" name="treatments" value="prescription">Prescription treatment</label>
        <label class="cmp-adaptiveform-checkboxgroup__option-label"><input class="cmp-adaptiveform-checkboxgroup__option__widget" type="checkbox" name="treatments" value="none">None of the above</label>
      </div></div><fieldset id="next" hidden><legend>How satisfied are you?</legend>
        <label><input type="radio" name="satisfaction" value="satisfied">Satisfied</label>
        <label><input type="radio" name="satisfaction" value="unsatisfied">Not satisfied</label></fieldset>
      <label>Email Address<input type="email" name="email" required></label>
      <label>Confirm Email Address<input type="email" name="confirmEmail" required></label><button>Submit</button></form>
      <script>document.querySelectorAll('[name=treatments]').forEach(input => input.addEventListener('change', () => {
        document.querySelector('#next').hidden = !document.querySelector('[name=treatments]:checked');
      }));
      document.querySelector('form').onsubmit = async event => {event.preventDefault();
        const values=Object.fromEntries(new FormData(event.target));
        await fetch('/checkbox-quiz-submit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(values)});
        document.body.innerHTML='<h1>Thank you for your answers</h1>';
      };</script>`));
    app.post('/checkbox-quiz-submit', async request => { submitted.push(request.body as Record<string, string>); return { ok: true }; });
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
    try {
      const page = await browser.newPage(); await page.goto(address);
      await page.locator('#inputMode').selectOption('ai-guided');
      await page.locator('#url').fill(`${address}/checkbox-quiz`);
      await page.locator('#submit').check(); await page.locator('#start').click();
      await page.getByLabel(/^Email Address/).waitFor({ timeout: 30000 });
      const id = await page.locator('#run-id').innerText();
      expect(store.get(id)?.inputRequest?.fields?.map(field => field.name)).toEqual(['email', 'confirmEmail']);
      expect(store.get(id)?.inputRequest?.fields?.some(field => field.type === 'checkbox')).toBe(false);
      await page.getByLabel(/^Email Address/).fill('recipient@example.test');
      await page.getByLabel(/^Confirm Email Address/).fill('recipient@example.test');
      await page.locator('#upload-step').click();
      await expect.poll(() => store.get(id)?.status, { timeout: 30000 }).toBe('passed');
      expect(submitted[0]).toMatchObject({ symptoms: 'constipation', treatments: 'prescription',
        satisfaction: 'satisfied', email: 'recipient@example.test', confirmEmail: 'recipient@example.test' });
    } finally { await browser.close(); await runner.close(); await app.close(); }
  }, 90000);

  it('probes an unlabeled branch choice and waits for the user before following its form', async () => {
    const store = new RunStore(path.resolve('work/ai-guided-discovery-test')); await store.initialize();
    const generator = new DeterministicDataGenerator();
    const runner = new FormRunner(store, generator, { allowedTargetHosts: new Set(['127.0.0.1']),
      allowPrivateNetworks: true, headless: true, timeoutMs: 90000, formReadyTimeoutMs: 1500 });
    const app = await buildApp({ store, runner, queue: new JobQueue(1), allowedTargetHosts: new Set(['127.0.0.1']),
      allowPrivateNetworks: true, maxSteps: 4, dataGenerator: generator });
    const submitted: Record<string, string>[] = [];
    app.get('/unknown-branch', async (_request, reply) => reply.type('text/html').send(`<!doctype html><form>
      <label>First name<input name="firstName" required></label>
      <fieldset><legend>Preferred route</legend><label><input type="radio" name="route" value="a">Option A</label>
        <label><input type="radio" name="route" value="b">Option B</label></fieldset>
      <div id="branch"></div><button>Submit</button></form>
      <script>document.querySelectorAll('[name=route]').forEach(input => input.onchange = () => {
        document.querySelector('#branch').innerHTML = input.value === 'a'
          ? '<label>Option A detail<input name="detailA" required></label>'
          : '<label>Option B detail<input name="detailB" required></label>';
      });
      document.querySelector('form').onsubmit = async event => {event.preventDefault();
        await fetch('/unknown-submit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(event.target)))});
        document.body.innerHTML='<h1>Thank you for registering</h1>';
      };</script>`));
    app.post('/unknown-submit', async request => { submitted.push(request.body as Record<string, string>); return { ok: true }; });
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
    try {
      const page = await browser.newPage();
      await page.goto(address);
      await page.locator('#inputMode').selectOption('ai-guided');
      await page.locator('#url').fill(`${address}/unknown-branch`);
      await page.locator('#submit').check(); await page.locator('#start').click();
      const route = page.getByRole('group', { name: 'Preferred route' });
      await route.getByRole('radio', { name: 'Option B' }).waitFor({ timeout: 30000 });
      expect(await page.getByLabel('First name').count()).toBe(0);
      await route.getByRole('radio', { name: 'Option B' }).check();
      await page.locator('#upload-step').click();
      const id = await page.locator('#run-id').innerText();
      await expect.poll(() => store.get(id)?.status, { timeout: 30000 }).toBe('passed');
      expect(submitted[0]).toMatchObject({ route: 'b' });
      expect(submitted[0]?.detailB).toBeTruthy();
      expect(submitted[0]?.detailA).toBeUndefined();
    } finally { await browser.close(); await runner.close(); await app.close(); }
  }, 90000);

  it('asks for a LINZESS-style yes/no decision in the middle of a form before opening its branch', async () => {
    const store = new RunStore(path.resolve('work/ai-guided-middle-radio-test')); await store.initialize();
    const generator = new DeterministicDataGenerator();
    const runner = new FormRunner(store, generator, { allowedTargetHosts: new Set(['127.0.0.1']),
      allowPrivateNetworks: true, headless: true, timeoutMs: 90000, formReadyTimeoutMs: 1500 });
    const app = await buildApp({ store, runner, queue: new JobQueue(1), allowedTargetHosts: new Set(['127.0.0.1']),
      allowPrivateNetworks: true, maxSteps: 4, dataGenerator: generator });
    const selections: string[] = [];
    const submitted: Record<string, string>[] = [];
    app.get('/middle-radio', async (_request, reply) => reply.type('text/html').send(`<!doctype html><form>
      <label>First name<input name="firstName" required></label>
      <label>Email Address<input name="email" type="email" required></label>
      <label>Verify Email Address<input name="verifyEmail" type="email" required></label>
      <label>Mobile Phone Number<input name="phone" type="tel" required></label>
      <div class="medication-question"><p>Are you currently taking LINZESS?</p>
        <label><input type="radio" name="medication" value="yes" required>Yes</label>
        <label><input type="radio" name="medication" value="no">No</label></div>
      <div id="branch"></div><button>Submit</button></form>
      <script>document.querySelectorAll('[name=medication]').forEach(input => input.onchange = () => {
        fetch('/middle-selection', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({choice:input.value})});
        document.querySelector('#branch').innerHTML = input.value === 'yes'
          ? '<p>How long have you been on LINZESS?</p><select name="howlongList" required>' +
            '<option value="">Please Select</option><option value="218">Less than 2 weeks</option>' +
            '<option value="219">Between 2-4 weeks</option></select>' +
            '<fieldset><legend>What kind of insurance do you have?</legend>' +
            '<label><input type="radio" name="insurance" value="private">Private insurance</label>' +
            '<label><input type="radio" name="insurance" value="other">Other</label></fieldset>' +
            '<label><input type="checkbox" name="marketingoptin" required>Marketing consent</label>' +
            '<label>Card activation number<input name="cardNumber" required></label>'
          : '<label>Reason<input name="reason"></label>';
      });
      document.querySelector('form').onsubmit = async event => {event.preventDefault();
        await fetch('/middle-submit', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(event.target)))});
        document.body.innerHTML='<h1>Thank you for registering</h1>';
      };</script>`));
    app.post('/middle-selection', async request => { selections.push((request.body as { choice: string }).choice); return { ok: true }; });
    app.post('/middle-submit', async request => { submitted.push(request.body as Record<string, string>); return { ok: true }; });
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
    try {
      const page = await browser.newPage();
      await page.goto(address);
      await page.locator('#inputMode').selectOption('ai-guided');
      await page.locator('#url').fill(`${address}/middle-radio`);
      await page.locator('#submit').check(); await page.locator('#start').click();
      const question = page.getByRole('group', { name: 'Are you currently taking LINZESS?' });
      await question.getByRole('radio', { name: 'Yes' }).waitFor({ timeout: 30000 });
      expect(selections).toEqual([]);
      expect(await page.getByLabel('First name').count()).toBe(0);
      expect(await page.getByLabel('Mobile Phone Number').count()).toBe(0);
      const id = await page.locator('#run-id').innerText();
      expect(store.get(id)?.inputRequest?.fields?.map(field => field.label)).toEqual(['Email Address', 'Verify Email Address', 'Yes', 'No']);
      await page.getByLabel(/^Email Address/).fill('recipient@example.test');
      await page.getByLabel(/^Verify Email Address/).fill('wrong@example.test');
      await question.getByRole('radio', { name: 'Yes' }).check();
      await page.locator('#upload-step').click();
      await page.getByText(/enter the same email address/).waitFor({ timeout: 5000 });
      await page.getByLabel(/^Verify Email Address/).fill('recipient@example.test');
      await page.locator('#upload-step').click();
      await page.getByLabel('Card activation number').waitFor({ timeout: 30000 });
      expect(selections).toEqual(['yes']);
      expect(store.get(id)?.inputRequest?.fields?.map(field => field.label)).toEqual(['Card activation number']);
      expect(await page.getByLabel('How long have you been on LINZESS?').count()).toBe(0);
      expect(await page.getByRole('group', { name: 'What kind of insurance do you have?' }).count()).toBe(0);
      expect(await page.getByLabel('Marketing consent').count()).toBe(0);
      await page.getByLabel('Card activation number').fill('001234');
      await page.locator('#upload-step').click();
      await expect.poll(() => store.get(id)?.status, { timeout: 30000 }).toBe('passed');
      expect(submitted[0]).toMatchObject({ email: 'recipient@example.test', verifyEmail: 'recipient@example.test', howlongList: '218',
        insurance: 'private', marketingoptin: 'on', cardNumber: '001234' });
    } finally { await browser.close(); await runner.close(); await app.close(); }
  }, 90000);

  it('shows radio questions and does not ask for the already selected routing radio again', async () => {
    const store = new RunStore(path.resolve('work/ai-guided-radio-test')); await store.initialize();
    const generator = new DeterministicDataGenerator();
    const runner = new FormRunner(store, generator, { allowedTargetHosts: new Set(['127.0.0.1']),
      allowPrivateNetworks: true, headless: true, timeoutMs: 90000, formReadyTimeoutMs: 1500 });
    const app = await buildApp({ store, runner, queue: new JobQueue(1), allowedTargetHosts: new Set(['127.0.0.1']),
      allowPrivateNetworks: true, maxSteps: 4, dataGenerator: generator });
    app.get('/radio-gate', async (_request, reply) => reply.type('text/html').send(`<!doctype html><form>
      <fieldset><legend>Are you currently prescribed QULIPTA?</legend>
        <label><input type="radio" name="prescribed" value="yes">Yes</label>
        <label><input type="radio" name="prescribed" value="no">No</label></fieldset><div id="next"></div></form>
      <script>document.querySelectorAll('[name=prescribed]').forEach(input => input.onchange = () => {
        document.querySelector('#next').innerHTML = '<fieldset><legend>Do you have a QULIPTA Complete Savings Card?</legend>' +
          '<label><input type="radio" name="card" value="activate">Yes, I need to activate my card</label>' +
          '<label><input type="radio" name="card" value="new">No, I need a new card</label></fieldset>' +
          '<fieldset><legend>Gender</legend><label><input type="radio" name="gender" value="male">Male</label>' +
          '<label><input type="radio" name="gender" value="female">Female</label></fieldset>' +
          '<label>First name<input name="firstName" required></label>' +
          '<label>Email Address<input name="email" type="email" required></label>' +
          '<label>Phone number<input name="phone" type="tel" required></label>' +
          '<label>State<select name="state" required><option value="">Choose</option><option value="NY">New York</option></select></label>' +
          '<button>Submit</button>';
      });
      let submitCount = 0;
      document.querySelector('form').onsubmit = event => {event.preventDefault(); submitCount += 1;
        if (submitCount === 1) {
          const alert = document.createElement('p'); alert.setAttribute('role', 'alert');
          alert.textContent = 'Please try again'; document.querySelector('form').append(alert);
        } else document.body.innerHTML='<h1>Thank you for registering</h1>';
      };</script>`));
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
    try {
      const page = await browser.newPage();
      await page.goto(address);
      await page.locator('#inputMode').selectOption('ai-guided');
      await page.locator('#url').fill(`${address}/radio-gate`);
      await page.locator('#submit').check(); await page.locator('#start').click();
      const route = page.locator('.route-choice');
      await route.getByRole('radio', { name: 'Yes' }).waitFor({ timeout: 30000 });
      expect(await route.getByText('Are you currently prescribed QULIPTA?').count()).toBe(1);
      expect(await page.locator('#next-action').count()).toBe(0);
      await route.getByRole('radio', { name: 'Yes' }).check();
      await page.locator('#upload-step').click();
      const card = page.getByRole('group', { name: 'Do you have a QULIPTA Complete Savings Card?' });
      await card.getByRole('radio', { name: 'Yes, I need to activate my card' }).waitFor({ timeout: 30000 });
      expect(await page.getByRole('group', { name: 'Are you currently prescribed QULIPTA?' }).count()).toBe(0);
      expect(await page.getByRole('group', { name: 'Gender' }).count()).toBe(0);
      expect(await page.getByLabel('Email Address').count()).toBe(0);
      expect(await page.getByLabel('Phone number').count()).toBe(0);
      expect(await page.getByLabel('State').count()).toBe(0);
      expect(await page.locator('#stepExcel').count()).toBe(0);
      await card.getByRole('radio', { name: 'Yes, I need to activate my card' }).check();
      await page.locator('#upload-step').click();
      const id = await page.locator('#run-id').innerText();
      await expect.poll(() => store.get(id)?.status, { timeout: 30000 }).toBe('passed');
    } finally { await browser.close(); await runner.close(); await app.close(); }
  }, 90000);

  it('uses AI only for general fields, reveals card input, and requests an OTP without Excel', async () => {
    const store = new RunStore(path.resolve('work/ai-guided-test')); await store.initialize();
    const generator = new DeterministicDataGenerator();
    const generate = vi.spyOn(generator, 'generate');
    const runner = new FormRunner(store, generator, { allowedTargetHosts: new Set(['127.0.0.1']),
      allowPrivateNetworks: true, headless: true, timeoutMs: 180000, formReadyTimeoutMs: 1500 });
    const app = await buildApp({ store, runner, queue: new JobQueue(1), allowedTargetHosts: new Set(['127.0.0.1']),
      allowPrivateNetworks: true, maxSteps: 5, dataGenerator: generator });
    const received: Record<string, string>[] = [];
    app.get('/guided-ai', async (_request, reply) => reply.type('text/html').send(`<!doctype html><form>
      <label>First name<input name="firstName" required></label><label>Email<input name="email" type="email" required></label>
      <label>NPI Number<input name="npi" pattern="[0-9]{10}" required></label>
      <label><input name="existing" type="checkbox">I have an existing card</label><div id="card"></div><button>Send code</button></form>
      <script>document.querySelector('[name=existing]').onchange = event => {
        document.querySelector('#card').innerHTML = event.target.checked ? '<label>Card activation number<input name="cardNumber" required></label>' : '';
      };
      document.querySelector('form').onsubmit = async event => {
        event.preventDefault(); await fetch('/capture-ai', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(event.target)))});
        document.body.innerHTML='<form><label>Verification code<input name="otp" autocomplete="one-time-code" required pattern="[0-9]{6}"></label><button>Verify</button></form><p role="alert"></p>';
        document.querySelector('form').onsubmit = async event => { event.preventDefault();
          const response=await fetch('/verify-ai',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(event.target)))});
          if(response.ok) document.body.innerHTML='<h1>Thank you for registering</h1>';
          else document.querySelector('[role=alert]').textContent='Invalid verification code';
        };
      };</script>`));
    app.post('/capture-ai', async request => { received.push(request.body as Record<string, string>); return { ok: true }; });
    app.post('/verify-ai', async (request, reply) => {
      const values = request.body as Record<string, string>; received.push(values);
      return values.otp === '001234' ? { ok: true } : reply.code(400).send({ error: 'invalid_code' });
    });
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
    try {
      const page = await browser.newPage();
      await page.goto(address);
      await page.locator('#inputMode').selectOption('ai-guided');
      await page.locator('#url').fill(`${address}/guided-ai`);
      await page.locator('#submit').check(); await page.locator('#start').click();
      await page.getByLabel(/^Email/).waitFor({ timeout: 30000 });
      expect(await page.locator('#download-step').count()).toBe(0);
      expect(await page.locator('#stepExcel').count()).toBe(0);
      const id = await page.locator('#run-id').innerText();
      const first = store.get(id)!.inputRequest!;
      expect(first.kind).toBe('human-fields');
      expect(first.fields!.some(field => field.name === 'firstName')).toBe(false);
      expect(() => runner.stepInput.download(id, first.token)).toThrow(/direct form inputs/);
      const bad = await app.inject({ method: 'POST', url: `/v1/form-runs/${id}/input/${first.token}`, payload: { values: { fake: 'value' } } });
      expect(bad.statusCode).toBe(400);
      await page.getByLabel(/^Email/).fill('recipient@example.test');
      await page.getByLabel(/^NPI Number/).fill('0012345678');
      await page.getByLabel('I have an existing card').check();
      await page.locator('#upload-step').click();
      await page.getByLabel(/^Card activation number/).waitFor({ timeout: 30000 });
      await page.getByLabel(/^Card activation number/).fill('0000123456');
      await page.locator('#upload-step').click();
      await page.getByLabel(/^Verification code/).waitFor({ timeout: 30000 });
      expect(received[0]).toMatchObject({ email: 'recipient@example.test', npi: '0012345678', cardNumber: '0000123456' });
      expect(received[0]?.firstName).toBeTruthy();
      await page.getByLabel(/^Verification code/).fill('999999');
      await page.locator('#upload-step').click();
      await page.getByText(/Invalid verification code/).first().waitFor({ timeout: 30000 });
      await page.getByLabel(/^Verification code/).fill('001234');
      await page.locator('#upload-step').click();
      await expect.poll(() => store.get(id)?.status, { timeout: 30000 }).toBe('passed');
      expect(received.at(-1)).toEqual({ otp: '001234' });
      expect(store.get(id)?.artifacts.some(item => item.stage === 'confirmation')).toBe(true);
      expect(JSON.stringify(generate.mock.calls)).not.toMatch(/recipient@example|0012345678|0000123456|one-time-code/);
      await page.screenshot({ path: path.resolve('work/ai-guided-test/ui-complete.png'), fullPage: true });
    } finally { await browser.close(); await runner.close(); await app.close(); }
  }, 150000);
});

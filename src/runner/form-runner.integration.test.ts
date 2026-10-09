import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FormRunner } from './form-runner.js';
import { RunStore } from '../storage/run-store.js';
import type { RunRecord } from '../types.js';
import { DeterministicDataGenerator } from '../form/deterministic-data-generator.js';

const dynamicOuterHtml = `<!doctype html><html><body>
  <h1>Dynamic framed form</h1>
  <iframe id="aemFormFrame" src="/embedded-form.html" style="width:100%;height:700px"></iframe>
</body></html>`;

const delayedOuterHtml = `<!doctype html><html><body>
  <div id="loading">Loading form</div>
  <div id="mount"></div>
  <script>setTimeout(() => {
    document.querySelector('#mount').innerHTML = '<iframe src="/delayed-embedded.html"></iframe>';
    document.querySelector('#loading').remove();
  }, 2500);</script>
</body></html>`;

const delayedEmbeddedHtml = `<!doctype html><html><body>
  <form><label>First name<input name="firstName" required></label>
  <button type="submit">Submit</button></form>
</body></html>`;

const dynamicEmbeddedHtml = `<!doctype html><html><body>
  <form id="dynamic-form">
    <label>Condition
      <select name="condition" required>
        <option value="">Select a condition</option>
        <option value="eczema">Eczema</option>
        <option value="arthritis">Arthritis</option>
      </select>
    </label>
    <div id="conditional"></div>
  </form>
  <script>
    document.querySelector('select').addEventListener('change', () => {
      setTimeout(() => {
        document.querySelector('#conditional').innerHTML = [
          '<label style="display:block"><input style="display:none" type="checkbox" name="symptoms" value="itching"> Itching</label>',
          '<label style="display:block"><input style="display:none" type="checkbox" name="symptoms" value="dryness"> Dryness</label>',
          '<label>Email <input type="email" name="email" required></label>',
          '<button type="submit">Finish</button>'
        ].join('');
      }, 900);
    });
    document.querySelector('form').addEventListener('submit', event => {
      event.preventDefault();
      fetch('/af/submit/branch-test', { method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'g-recaptcha-response=branch-secret-token' });
      document.body.innerHTML = '<h2>Thank you from iframe</h2>';
    });
  </script>
</body></html>`;

const nestedBranchOuterHtml = `<!doctype html><html><body>
  <h1>Nested branch form</h1>
  <iframe id="aemFormFrame" src="/nested-branch-embedded.html" style="width:100%;height:700px"></iframe>
</body></html>`;

const nestedBranchEmbeddedHtml = `<!doctype html><html><body>
  <form id="nested-form">
    <label>Condition
      <select name="condition" required>
        <option value="">Select a condition</option>
        <option value="eczema">Eczema</option>
        <option value="arthritis">Arthritis</option>
      </select>
    </label>
    <div id="question"></div>
    <div id="leaf"></div>
  </form>
  <script>
    const form = document.querySelector('#nested-form');
    form.addEventListener('change', event => {
      if (event.target.name === 'condition') {
        setTimeout(() => {
          document.querySelector('#question').innerHTML = [
            '<fieldset><legend>Are you currently prescribed?</legend>',
            '<label><input type="radio" name="prescribed" value="yes">Yes</label>',
            '<label><input type="radio" name="prescribed" value="no">No</label></fieldset>'
          ].join('');
        }, 250);
      }
      if (event.target.name === 'prescribed') {
        const fieldName = event.target.value === 'yes' ? 'memberId' : 'email';
        const label = event.target.value === 'yes' ? 'Member ID' : 'Email';
        const type = event.target.value === 'yes' ? 'text' : 'email';
        setTimeout(() => {
          document.querySelector('#leaf').innerHTML = '<label>' + label + '<input type="' + type + '" name="' + fieldName + '" required></label><button type="submit">Submit</button>';
        }, 250);
      }
    });
    form.addEventListener('submit', event => event.preventDefault());
  </script>
</body></html>`;

const loginThenFrameHtml = `<!doctype html><html><body>
  <form id="login-form">
    <label>Email <input type="email" name="email" required></label>
    <button type="submit">Continue</button>
  </form>
  <div id="next-state"></div>
  <script>
    document.querySelector('form').addEventListener('submit', event => {
      event.preventDefault();
      setTimeout(() => {
        const trackingFrame = document.createElement('iframe');
        trackingFrame.src = '/tracking-frame.html';
        trackingFrame.style.display = 'none';
        document.body.append(trackingFrame);
      }, 100);
      setTimeout(() => {
        document.querySelector('#login-form').style.display = 'none';
        document.querySelector('#next-state').innerHTML = '<iframe src="/login-result-frame.html" style="width:100%;height:700px"></iframe>';
      }, 900);
    });
  </script>
</body></html>`;

const loginResultFrameHtml = `<!doctype html><html><body>
  <form>
    <label>First name <input name="firstName" required></label>
    <label>Last name <input name="lastName" required></label>
    <button type="submit">Submit</button>
  </form>
</body></html>`;

const redirectFirstFormHtml = `<!doctype html><html><body>
  <form>
    <label>Email <input type="email" name="email" required></label>
    <button type="submit">Get New Card</button>
  </form>
  <script>
    document.querySelector('form').addEventListener('submit', event => {
      event.preventDefault();
      location.href = '/redirect-second-form.html';
    });
  </script>
</body></html>`;

const redirectSecondFormHtml = `<!doctype html><html><body>
  <script>
    setTimeout(() => {
      document.body.innerHTML = '<form><label>First name <input name="firstName" required></label><button type="submit">Finish</button></form>';
      document.querySelector('form').addEventListener('submit', event => {
        event.preventDefault();
        document.body.innerHTML = '<h2>Thank you for requesting a card</h2>';
      });
    }, 900);
  </script>
</body></html>`;

const delayedConfirmationFormHtml = `<!doctype html><html><body>
  <form><label>First name <input name="firstName" required></label>
    <button type="submit">Submit</button></form>
  <script>document.querySelector('form').addEventListener('submit', event => {
    event.preventDefault();
    location.href = '/resources/sign-up/confirmation?insuType=10536&ptType=adu';
  });</script>
</body></html>`;

const delayedConfirmationHtml = `<!doctype html><html><body>
  <div>Loading your confirmation</div>
  <script>setTimeout(() => {
    document.body.innerHTML = '<h1>Congratulations, you are signed up for RINVOQ Complete</h1>';
  }, 2500);</script>
</body></html>`;

const blankConfirmationFormHtml = delayedConfirmationFormHtml.replace(
  '/resources/sign-up/confirmation?insuType=10536&ptType=adu',
  '/resources/sign-up/confirmation?blank=true'
);

const browserDescribe = process.env.RUN_BROWSER_TESTS === 'true' ? describe : describe.skip;

browserDescribe('FormRunner browser smoke test', () => {
  let origin: string;
  let closeServer: () => Promise<void>;
  let runner: FormRunner;
  let store: RunStore;

  beforeAll(async () => {
    const html = await readFile(path.resolve('public/demo-form.html'));
    const server = createServer((request, response) => {
      if (request.url === '/af/submit/branch-test') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end('{"success":true}');
        return;
      }
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      if (request.url === '/dynamic-form.html') response.end(dynamicOuterHtml);
      else if (request.url === '/delayed-form.html') response.end(delayedOuterHtml);
      else if (request.url === '/delayed-embedded.html') response.end(delayedEmbeddedHtml);
      else if (request.url === '/embedded-form.html') response.end(dynamicEmbeddedHtml);
      else if (request.url === '/nested-branch-form.html') response.end(nestedBranchOuterHtml);
      else if (request.url === '/nested-branch-embedded.html') response.end(nestedBranchEmbeddedHtml);
      else if (request.url === '/login-then-frame.html') response.end(loginThenFrameHtml);
      else if (request.url === '/login-result-frame.html') response.end(loginResultFrameHtml);
      else if (request.url === '/redirect-first-form.html') response.end(redirectFirstFormHtml);
      else if (request.url === '/redirect-second-form.html') response.end(redirectSecondFormHtml);
      else if (request.url === '/delayed-confirmation-form.html') response.end(delayedConfirmationFormHtml);
      else if (request.url === '/blank-confirmation-form.html') response.end(blankConfirmationFormHtml);
      else if (request.url === '/resources/sign-up/confirmation?blank=true') response.end('<!doctype html><html><body><div class="confirmation">Loading your confirmation</div></body></html>');
      else if (request.url?.startsWith('/resources/sign-up/confirmation')) response.end(delayedConfirmationHtml);
      else if (request.url === '/tracking-frame.html') response.end('<!doctype html><html><body>tracking</body></html>');
      else response.end(html);
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Unable to start fixture server.');
    origin = `http://127.0.0.1:${address.port}`;
    closeServer = () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));

    store = new RunStore(path.resolve('work/test-artifacts'));
    await store.initialize();
    const generator = new DeterministicDataGenerator();
    runner = new FormRunner(store, generator, {
      allowedTargetHosts: new Set(['127.0.0.1']),
      allowPrivateNetworks: true,
      headless: true,
      timeoutMs: 180_000,
      formReadyTimeoutMs: 5_000
    });
  });

  afterAll(async () => {
    await runner.close();
    await closeServer();
  });

  it('waits for a slow initial iframe before deciding that no form exists', async () => {
    const slowRunner = new FormRunner(store, new DeterministicDataGenerator(), {
      allowedTargetHosts: new Set(['127.0.0.1']), allowPrivateNetworks: true,
      headless: true, timeoutMs: 20_000, formReadyTimeoutMs: 1_000,
      initialFormReadyTimeoutMs: 5_000
    });
    const now = new Date().toISOString();
    const id = 'delayed-initial-form-smoke';
    await store.create({ id, request: { url: `${origin}/delayed-form.html`, scenario: 'basic',
      submit: false, maxSteps: 1, inputMode: 'excel-steps' }, status: 'queued',
      createdAt: now, updatedAt: now, currentStep: 0, formDetected: false,
      steps: [], artifacts: [], captcha: { detected: false } });
    try {
      const run = slowRunner.run(id);
      for (let attempt = 0; attempt < 60 && store.get(id)?.status !== 'awaiting_input'; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      const result = store.get(id)!;
      expect(result.formDetected).toBe(true);
      expect(result.currentStep).toBe(1);
      expect(result.status).toBe('awaiting_input');
      expect(result.steps[0]?.fieldCount).toBe(1);
      slowRunner.stepInput.cancel(id);
      await run;
    } finally {
      await slowRunner.close();
    }
  }, 25_000);

  it('completes two steps and captures confirmation evidence', async () => {
    const now = new Date().toISOString();
    const record: RunRecord = {
      id: 'browser-smoke',
      request: {
        url: `${origin}/demo-form.html`,
        scenario: 'hcp-registration',
        submit: true,
        maxSteps: 5,
        expectedOutcome: { textContains: 'Thank you for registering' }
      },
      status: 'queued',
      createdAt: now,
      updatedAt: now,
      currentStep: 0,
      formDetected: false,
      steps: [],
      artifacts: [],
      captcha: { detected: false }
    };
    await store.create(record);
    await runner.run(record.id);

    const completed = store.get(record.id);
    expect(completed?.status).toBe('passed');
    expect(completed?.steps).toHaveLength(2);
    expect(completed?.confirmation?.matched).toBe(true);
    expect(completed?.artifacts.filter(artifact => artifact.contentType === 'image/png')).toHaveLength(2);
    expect(completed?.artifacts.some(artifact => artifact.stage === 'page-load')).toBe(false);
    expect(completed?.artifacts.some(artifact => artifact.stage === 'step-2-final-filled')).toBe(true);
    expect(completed?.artifacts.some(artifact => artifact.stage === 'confirmation')).toBe(true);
  }, 60_000);

  it('waits for visible confirmation after a slow confirmation-page redirect', async () => {
    const slowRunner = new FormRunner(store, new DeterministicDataGenerator(), {
      allowedTargetHosts: new Set(['127.0.0.1']), allowPrivateNetworks: true,
      headless: true, timeoutMs: 30_000, formReadyTimeoutMs: 1_000,
      initialFormReadyTimeoutMs: 6_000
    });
    const now = new Date().toISOString();
    const id = 'delayed-confirmation-smoke';
    await store.create({ id, request: { url: `${origin}/delayed-confirmation-form.html`,
      scenario: 'basic', submit: true, maxSteps: 2 }, status: 'queued',
    createdAt: now, updatedAt: now, currentStep: 0, formDetected: false,
    steps: [], artifacts: [], captcha: { detected: false } });
    try {
      await slowRunner.run(id);
      const completed = store.get(id);
      expect(completed?.status).toBe('passed');
      expect(completed?.confirmation).toMatchObject({ matched: true, type: 'default-text' });
      expect(completed?.artifacts.some(artifact => artifact.stage === 'confirmation')).toBe(true);
      expect(completed?.artifacts.some(artifact => artifact.stage === 'pdf-report')).toBe(true);
    } finally {
      await slowRunner.close();
    }
  }, 30_000);

  it('does not mark a blank confirmation URL as passed', async () => {
    const slowRunner = new FormRunner(store, new DeterministicDataGenerator(), {
      allowedTargetHosts: new Set(['127.0.0.1']), allowPrivateNetworks: true,
      headless: true, timeoutMs: 30_000, formReadyTimeoutMs: 1_000,
      initialFormReadyTimeoutMs: 3_000
    });
    const now = new Date().toISOString();
    const id = 'blank-confirmation-smoke';
    await store.create({ id, request: { url: `${origin}/blank-confirmation-form.html`,
      scenario: 'basic', submit: true, maxSteps: 2 }, status: 'queued',
    createdAt: now, updatedAt: now, currentStep: 0, formDetected: false,
    steps: [], artifacts: [], captcha: { detected: false } });
    try {
      await slowRunner.run(id);
      const completed = store.get(id);
      expect(completed?.status).toBe('inconclusive');
      expect(completed?.confirmation?.matched).toBe(false);
      expect(completed?.artifacts.some(artifact => artifact.stage === 'confirmation')).toBe(false);
    } finally {
      await slowRunner.close();
    }
  }, 30_000);

  it('captures a slow confirmation in AI-guided mode', async () => {
    const slowRunner = new FormRunner(store, new DeterministicDataGenerator(), {
      allowedTargetHosts: new Set(['127.0.0.1']), allowPrivateNetworks: true,
      headless: true, timeoutMs: 30_000, formReadyTimeoutMs: 1_000,
      initialFormReadyTimeoutMs: 6_000
    });
    const now = new Date().toISOString();
    const id = 'guided-delayed-confirmation-smoke';
    await store.create({ id, request: { url: `${origin}/delayed-confirmation-form.html`,
      scenario: 'generic-form', submit: true, maxSteps: 2, inputMode: 'ai-guided' }, status: 'queued',
    createdAt: now, updatedAt: now, currentStep: 0, formDetected: false,
    steps: [], artifacts: [], captcha: { detected: false } });
    try {
      await slowRunner.run(id);
      const completed = store.get(id);
      expect(completed?.status).toBe('passed');
      expect(completed?.confirmation).toMatchObject({ matched: true, type: 'default-text' });
      expect(completed?.artifacts.some(artifact => artifact.stage === 'confirmation')).toBe(true);
    } finally {
      await slowRunner.close();
    }
  }, 30_000);

  it('captures every delayed select-option form inside an iframe', async () => {
    const now = new Date().toISOString();
    const record: RunRecord = {
      id: 'dynamic-frame-smoke',
      request: {
        url: `${origin}/dynamic-form.html`,
        scenario: 'basic',
        submit: true,
        maxSteps: 5,
        expectedOutcome: { textContains: 'Thank you from iframe' }
      },
      status: 'queued',
      createdAt: now,
      updatedAt: now,
      currentStep: 0,
      formDetected: false,
      steps: [],
      artifacts: [],
      captcha: { detected: false }
    };
    await store.create(record);
    await runner.run(record.id);

    const completed = store.get(record.id);
    expect(completed?.status).toBe('inconclusive');
    expect(completed?.error?.code).toBe('choice_branches_captured');
    expect(completed?.artifacts.filter(artifact => artifact.stage.endsWith(':selected'))).toHaveLength(0);
    expect(completed?.artifacts.filter(artifact => artifact.stage.endsWith(':final-filled'))).toHaveLength(2);
    expect(completed?.artifacts.filter(artifact => artifact.stage.endsWith(':destination'))).toHaveLength(2);
    expect(completed?.networkDiagnostics?.filter(item => item.endpoint.endsWith('/af/submit/branch-test'))).toHaveLength(2);
    expect(completed?.networkDiagnostics?.find(item => item.endpoint.endsWith('/af/submit/branch-test')))
      .toMatchObject({ status: 200, captchaTokenInBody: 'present' });
    expect(JSON.stringify(completed?.networkDiagnostics)).not.toContain('branch-secret-token');
  }, 180_000);

  it('waits for an email/continue state to load a different iframe form', async () => {
    const now = new Date().toISOString();
    const record: RunRecord = {
      id: 'login-frame-smoke',
      request: {
        url: `${origin}/login-then-frame.html`,
        scenario: 'basic',
        submit: false,
        maxSteps: 5
      },
      status: 'queued',
      createdAt: now,
      updatedAt: now,
      currentStep: 0,
      formDetected: false,
      steps: [],
      artifacts: [],
      captcha: { detected: false }
    };
    await store.create(record);
    await runner.run(record.id);

    const completed = store.get(record.id);
    expect(completed?.status).toBe('inconclusive');
    expect(completed?.steps).toHaveLength(2);
    expect(completed?.steps[0]?.action).toMatch(/^next:Continue/);
    expect(completed?.steps[1]?.action).toBe('submit-not-authorized');
    expect(completed?.artifacts.some(artifact => artifact.stage === 'step-2-final-filled')).toBe(true);
  }, 60_000);

  it('continues when submit redirects to another delayed form', async () => {
    const now = new Date().toISOString();
    const record: RunRecord = {
      id: 'redirect-form-smoke',
      request: {
        url: `${origin}/redirect-first-form.html`,
        scenario: 'basic',
        submit: true,
        maxSteps: 5,
        expectedOutcome: { textContains: 'Thank you for requesting a card' }
      },
      status: 'queued',
      createdAt: now,
      updatedAt: now,
      currentStep: 0,
      formDetected: false,
      steps: [],
      artifacts: [],
      captcha: { detected: false }
    };
    await store.create(record);
    await runner.run(record.id);

    const completed = store.get(record.id);
    expect(completed?.status).toBe('passed');
    expect(completed?.steps).toHaveLength(2);
    expect(completed?.steps[0]?.action).toMatch(/^submit:Get New Card/);
    expect(completed?.artifacts.some(artifact => artifact.stage === 'step-2-final-filled')).toBe(true);
    expect(completed?.confirmation?.matched).toBe(true);
  }, 60_000);

  it('captures every nested select and radio branch combination', async () => {
    const now = new Date().toISOString();
    const record: RunRecord = {
      id: 'nested-branch-smoke',
      request: {
        url: `${origin}/nested-branch-form.html`,
        scenario: 'basic',
        submit: false,
        maxSteps: 5
      },
      status: 'queued',
      createdAt: now,
      updatedAt: now,
      currentStep: 0,
      formDetected: false,
      steps: [],
      artifacts: [],
      captcha: { detected: false }
    };
    await store.create(record);
    await runner.run(record.id);

    const completed = store.get(record.id);
    expect(completed?.status).toBe('inconclusive');
    expect(completed?.error?.code).toBe('choice_branches_captured');
    expect(completed?.artifacts.filter(artifact => artifact.stage.endsWith(':final-filled'))).toHaveLength(4);
    expect(completed?.artifacts.some(artifact => artifact.stage.includes('Eczema > Yes:final-filled'))).toBe(true);
    expect(completed?.artifacts.some(artifact => artifact.stage.includes('Eczema > No:final-filled'))).toBe(true);
    expect(completed?.artifacts.some(artifact => artifact.stage.includes('Arthritis > Yes:final-filled'))).toBe(true);
    expect(completed?.artifacts.some(artifact => artifact.stage.includes('Arthritis > No:final-filled'))).toBe(true);
  }, 180_000);
});

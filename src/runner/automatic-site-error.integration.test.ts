import { createServer } from 'node:http';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DeterministicDataGenerator } from '../form/deterministic-data-generator.js';
import { RunStore } from '../storage/run-store.js';
import { FormRunner } from './form-runner.js';

const browserDescribe = process.env.RUN_BROWSER_TESTS === 'true' ? describe : describe.skip;

browserDescribe('automatic submission with a reCAPTCHA badge', () => {
  it('reports the site error after clicking instead of claiming a human challenge', async () => {
    const server = createServer((request, response) => {
      if (request.url?.startsWith('/registration?')) {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ RegistrationResponse: { IsStatusSuccessful: false, ErrorCode: 'INVALID_CARD' },
          privateValue: 'never record this' }));
        return;
      }
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end(`<!doctype html><form>
        <label>Name<input name="name" required></label>
        <div class="g-recaptcha" style="width:180px;height:35px">Protected by reCAPTCHA</div>
        <button type="submit">Get New Card</button>
      </form><p id="site-error" style="display:none">Your request could not be processed. Please try again later.</p>
      <script>document.querySelector('form').onsubmit = async event => {
        event.preventDefault();
        await fetch('/registration?token=secret', { method: 'POST' });
        document.querySelector('#site-error').style.display='block';
      };</script>`);
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Fixture server unavailable');
    const store = new RunStore(path.resolve('work/excel-upload-test/automatic-site-error'));
    await store.initialize();
    const runner = new FormRunner(store, new DeterministicDataGenerator(), {
      allowedTargetHosts: new Set(['127.0.0.1']), allowPrivateNetworks: true,
      headless: true, timeoutMs: 45_000, formReadyTimeoutMs: 1_500
    });
    const runId = 'automatic-site-error';
    const now = new Date().toISOString();
    await store.create({ id: runId, status: 'queued', createdAt: now, updatedAt: now,
      request: { url: `http://127.0.0.1:${address.port}`, scenario: 'basic', submit: true, maxSteps: 3, inputMode: 'automatic' },
      currentStep: 0, formDetected: false, steps: [], artifacts: [], captcha: { detected: false } });
    try {
      await runner.run(runId);
      const result = store.get(runId)!;
      expect(result.status).toBe('inconclusive');
      expect(result.error?.code).toBe('site_rejected_submission');
      expect(result.error?.message).toContain('Your request could not be processed');
      expect(result.captcha.detected).toBe(true);
      expect(result.captcha.blocking).toBe(false);
      expect(result.steps[0]?.action).toBe('submit:Get New Card');
      expect(result.steps[0]?.screenshot).toContain('rejected');
      expect(result.networkDiagnostics).toEqual(expect.arrayContaining([expect.objectContaining({
        step: 1, action: 'submit:Get New Card', method: 'POST',
        endpoint: `http://127.0.0.1:${address.port}/registration`, status: 200,
        signals: { 'RegistrationResponse.IsStatusSuccessful': false, 'RegistrationResponse.ErrorCode': 'INVALID_CARD' }
      })]));
      expect(JSON.stringify(result.networkDiagnostics)).not.toContain('secret');
      expect(JSON.stringify(result.networkDiagnostics)).not.toContain('never record this');
    } finally {
      await runner.close();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  }, 45_000);

  it('reports an HTTP rejection even when the site shows no error text', async () => {
    const server = createServer((request, response) => {
      if (request.url === '/af/submit/test') {
        response.writeHead(400, { 'content-type': 'text/plain' });
        response.end('CAPTCHA verification failed');
        return;
      }
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end(`<!doctype html><form><label>Name<input name="name" required></label>
        <button type="submit">Get New Card</button></form>
        <script>document.querySelector('form').onsubmit = event => {
          event.preventDefault(); fetch('/af/submit/test', { method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: 'name=Example&g-recaptcha-response=opaque-secret-token' });
        };</script>`);
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Fixture server unavailable');
    const store = new RunStore(path.resolve('work/excel-upload-test/automatic-http-error'));
    await store.initialize();
    const runner = new FormRunner(store, new DeterministicDataGenerator(), {
      allowedTargetHosts: new Set(['127.0.0.1']), allowPrivateNetworks: true,
      headless: true, timeoutMs: 45_000, formReadyTimeoutMs: 1_500
    });
    const runId = 'automatic-http-error';
    const now = new Date().toISOString();
    await store.create({ id: runId, status: 'queued', createdAt: now, updatedAt: now,
      request: { url: `http://127.0.0.1:${address.port}`, scenario: 'basic', submit: true, maxSteps: 3, inputMode: 'automatic' },
      currentStep: 0, formDetected: false, steps: [], artifacts: [], captcha: { detected: false } });
    try {
      await runner.run(runId);
      const result = store.get(runId)!;
      expect(result.status).toBe('inconclusive');
      expect(result.error?.code).toBe('site_rejected_submission');
      expect(result.error?.message).toContain('POST /af/submit/test: HTTP 400');
      expect(result.networkDiagnostics?.find(item => item.status === 400)).toMatchObject({
        responseHints: ['captcha'], captchaTokenInBody: 'present'
      });
      expect(JSON.stringify(result.networkDiagnostics)).not.toContain('verification failed');
      expect(JSON.stringify(result.networkDiagnostics)).not.toContain('opaque-secret-token');
    } finally {
      await runner.close();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  }, 45_000);
});

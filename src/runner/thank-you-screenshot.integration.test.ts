import { createServer } from 'node:http';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DeterministicDataGenerator } from '../form/deterministic-data-generator.js';
import { RunStore } from '../storage/run-store.js';
import { FormRunner } from './form-runner.js';

const browserDescribe = process.env.RUN_BROWSER_TESTS === 'true' ? describe : describe.skip;

browserDescribe('thank-you screenshot completion', () => {
  it('passes when it captures the thank-you page while retaining a failed request in diagnostics', async () => {
    const server = createServer((request, response) => {
      if (request.url?.startsWith('/abbviecloud/adobe/forms/af/submit/')) {
        response.writeHead(502, { 'content-type': 'text/plain' });
        response.end('Gateway failure');
        return;
      }
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end(`<!doctype html><form><label>Name<input name="name" required></label>
        <button type="submit">Activate Your Card</button></form>
        <script>document.querySelector('form').onsubmit = async event => {
          event.preventDefault();
          await fetch('/abbviecloud/adobe/forms/af/submit/form', {method:'POST'});
          document.body.innerHTML = '<h1>Thank you for your interest.</h1><p>You are not eligible to participate in this program.</p>';
        };</script>`);
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Fixture server unavailable');
    const store = new RunStore(path.resolve('work/excel-upload-test/thank-you-screenshot'));
    await store.initialize();
    const runner = new FormRunner(store, new DeterministicDataGenerator(), {
      allowedTargetHosts: new Set(['127.0.0.1']), allowPrivateNetworks: true,
      headless: true, timeoutMs: 45_000, formReadyTimeoutMs: 1_500
    });
    const runId = 'thank-you-screenshot';
    const now = new Date().toISOString();
    await store.create({ id: runId, status: 'queued', createdAt: now, updatedAt: now,
      request: { url: `http://127.0.0.1:${address.port}`, scenario: 'generic-form', submit: true, maxSteps: 3, inputMode: 'automatic' },
      currentStep: 0, formDetected: false, steps: [], artifacts: [], captcha: { detected: false } });
    try {
      await runner.run(runId);
      const result = store.get(runId)!;
      expect(result.status).toBe('passed');
      expect(result.confirmation?.value).toContain('Thank you');
      expect(result.artifacts.some(item => item.stage === 'confirmation')).toBe(true);
      expect(result.networkDiagnostics?.some(item => item.status === 502)).toBe(true);
    } finally {
      await runner.close();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  }, 45_000);
});

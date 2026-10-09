import { createServer } from 'node:http';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { RunStore } from '../storage/run-store.js';
import { FormRunner } from './form-runner.js';
import { DeterministicDataGenerator } from '../form/deterministic-data-generator.js';

const browserDescribe = process.env.RUN_BROWSER_TESTS === 'true' ? describe : describe.skip;
browserDescribe('guided registration email', () => {
  it('requests a single email and lets the user replace a duplicate without sending it to AI', async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end(`<!doctype html><form>
        <label>First name<input name="firstName" required></label>
        <label>Email Address<input name="email" type="email" required></label>
        <p id="feedback"></p><button type="submit">Submit</button></form>
        <script>document.querySelector('form').onsubmit = event => {
          event.preventDefault();
          if(document.querySelector('[name=email]').value === 'used@example.test') {
            document.querySelector('#feedback').textContent = 'This email address may already be in use. Please call support.';
          } else { document.body.innerHTML = '<h1>Thank you for registering</h1>'; }
        };</script>`);
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing server address');
    const store = new RunStore(path.resolve('work/guided-email-test'));
    await store.initialize();
    const generator = new DeterministicDataGenerator();
    const generate = vi.spyOn(generator, 'generate');
    const runner = new FormRunner(store, generator, { allowedTargetHosts: new Set(['127.0.0.1']),
      allowPrivateNetworks: true, headless: true, timeoutMs: 45000, formReadyTimeoutMs: 1000 });
    const now = new Date().toISOString();
    const id = 'single-email-retry';
    await store.create({ id, request: { url: `http://127.0.0.1:${address.port}/form`,
      scenario: 'generic-form', inputMode: 'ai-guided', submit: true, maxSteps: 3 },
      status: 'queued', createdAt: now, updatedAt: now, currentStep: 0,
      formDetected: false, steps: [], artifacts: [], captcha: { detected: false } });
    const running = runner.run(id);
    try {
      await vi.waitFor(() => expect(store.get(id)?.status).toBe('awaiting_input'), { timeout: 15000 });
      const first = store.get(id)!.inputRequest!;
      expect(first.fields?.map(field => field.name)).toEqual(['email']);
      await runner.stepInput.upload(id, first.token, undefined, false, undefined, false,
        { [first.fields![0]!.id]: 'used@example.test' });
      await vi.waitFor(() => {
        expect(store.get(id)?.status).toBe('awaiting_input');
        expect(store.get(id)?.inputRequest?.message).toContain('already be in use');
      }, { timeout: 20000 });
      const correction = store.get(id)!.inputRequest!;
      await runner.stepInput.upload(id, correction.token, undefined, false, undefined, false,
        { [correction.fields![0]!.id]: 'fresh@example.test' });
      await running;
      expect(store.get(id)?.status).toBe('passed');
      expect(generate.mock.calls.every(([input]) => input.fields.every(field => field.type !== 'email'))).toBe(true);
    } finally {
      await runner.close();
      await running;
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  }, 55000);
});

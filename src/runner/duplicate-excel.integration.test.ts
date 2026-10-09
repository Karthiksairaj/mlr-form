import { createServer } from 'node:http';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { describe, expect, it, vi } from 'vitest';
import { DeterministicDataGenerator } from '../form/deterministic-data-generator.js';
import { RunStore } from '../storage/run-store.js';
import { FormRunner } from './form-runner.js';

const browserDescribe = process.env.RUN_BROWSER_TESTS === 'true' ? describe : describe.skip;

browserDescribe('Excel fields with duplicate semantic identities', () => {
  it('fills each fresh workbook answer into its own control', async () => {
    const received: string[][] = [];
    const server = createServer(async (request, response) => {
      if (request.method === 'POST') {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        received.push(JSON.parse(Buffer.concat(chunks).toString()));
        response.end('ok');
        return;
      }
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end(`<!doctype html><form>
        <label>Reference<input name="reference" required></label>
        <label>Reference<input name="reference" required></label><button>Submit</button>
      </form><script>document.querySelector('form').onsubmit = async event => {
        event.preventDefault(); await fetch('/received', {method:'POST',
          body:JSON.stringify(new FormData(event.target).getAll('reference'))});
        document.body.innerHTML='<h1>Thank you for registering</h1>';
      };</script>`);
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Fixture server unavailable');
    const store = new RunStore(path.resolve('work/excel-upload-test/duplicates'));
    await store.initialize();
    const runner = new FormRunner(store, new DeterministicDataGenerator(), {
      allowedTargetHosts: new Set(['127.0.0.1']), allowPrivateNetworks: true,
      headless: true, timeoutMs: 45_000, formReadyTimeoutMs: 1_500
    });
    const now = new Date().toISOString();
    await store.create({ id: 'duplicate-controls', status: 'queued', createdAt: now, updatedAt: now,
      request: { url: `http://127.0.0.1:${address.port}`, scenario: 'basic', submit: true, maxSteps: 3, inputMode: 'excel-steps' },
      currentStep: 0, formDetected: false, steps: [], artifacts: [], captcha: { detected: false } });
    const running = runner.run('duplicate-controls');
    try {
      await vi.waitFor(() => expect(store.get('duplicate-controls')?.status).toBe('awaiting_input'), { timeout: 20_000 });
      const token = store.get('duplicate-controls')!.inputRequest!.token;
      const book = new ExcelJS.Workbook();
      await book.xlsx.load(Uint8Array.from(runner.stepInput.download('duplicate-controls', token)).buffer);
      expect(book.getWorksheet('Payload')!.rowCount).toBe(3);
      book.getWorksheet('Payload')!.getCell('B2').value = 'first-reference';
      book.getWorksheet('Payload')!.getCell('B3').value = 'second-reference';
      await runner.stepInput.upload('duplicate-controls', token,
        { filename: 'duplicates.xlsx', base64: Buffer.from(await book.xlsx.writeBuffer()).toString('base64') }, false);
      await running;
      expect(store.get('duplicate-controls')?.status).toBe('passed');
      expect(received).toEqual([['first-reference', 'second-reference']]);
    } finally {
      await runner.close();
      await running;
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  }, 60_000);
});

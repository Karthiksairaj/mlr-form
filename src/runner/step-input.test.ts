import ExcelJS from 'exceljs';
import { describe, expect, it, vi } from 'vitest';
import { StepInput } from './step-input.js';
import type { RunStore } from '../storage/run-store.js';
import type { FormField, RunRecord } from '../types.js';

const fields: FormField[] = [{ id: 'one', tag: 'input', type: 'text', label: 'First name', required: true, disabled: false, readOnly: false }];
function setup() {
  const record = {} as RunRecord;
  const store = { update: vi.fn(async (_id, update) => Object.assign(record, update)) } as unknown as RunStore;
  return { input: new StepInput(store), record };
}

describe('waiting browser input', () => {
  it('accepts direct values with token validation and disallows AI and workbook access', async () => {
    const { input, record } = setup();
    const pending = input.wait('run', fields, 1, 'https://example.test', new AbortController().signal,
      '2099-01-01', 'Enter values', 'human-token', { kind: 'human-fields' });
    await vi.waitFor(() => expect(record.inputRequest?.kind).toBe('human-fields'));
    expect(record.inputRequest?.downloadUrl).toBe('');
    expect(() => input.download('run', 'human-token')).toThrow(/direct form inputs/);
    await expect(input.upload('run', 'stale', undefined, false, undefined, false, { one: 'A' })).rejects.toThrow(/no longer/);
    await expect(input.upload('run', 'human-token', undefined, true, undefined, false, { one: 'A' })).rejects.toThrow(/AI and Excel/);
    await expect(input.upload('run', 'human-token', undefined, false, undefined, false, {})).rejects.toThrow(/missing/);
    await input.upload('run', 'human-token', undefined, false, undefined, false, { one: 'A' });
    expect((await pending).values).toEqual([{ fieldId: 'one', value: 'A' }]);
    expect(record.inputRequest).toBeUndefined();
  });
  it('publishes a flow choice and accepts one valid action without a workbook', async () => {
    const { input, record } = setup();
    const actions = [
      { id: 'new-card', label: 'Get New Card', kind: 'submit' as const },
      { id: 'activate', label: 'Activate Existing Card', kind: 'submit' as const }
    ];
    const pending = input.wait('run', [], 1, 'https://example.test', new AbortController().signal,
      '2099-01-01', 'Choose the form action', 'action-token', { kind: 'action', actions });
    await vi.waitFor(() => expect(record.inputRequest?.kind).toBe('action'));
    expect(record.inputRequest?.actions).toEqual(actions);
    expect(() => input.download('run', 'action-token')).toThrow('requires choosing the next action');
    for (const actionId of [undefined, 'unknown']) {
      await expect(input.upload('run', 'action-token', undefined, false, actionId)).rejects.toThrow('Choose one');
      expect(record.status).toBe('awaiting_input');
      expect(record.inputRequest?.token).toBe('action-token');
    }
    await expect(input.upload('run', 'old-token', undefined, false, 'activate')).rejects.toThrow('no longer');
    expect(record.status).toBe('awaiting_input');
    const results = await Promise.allSettled([
      input.upload('run', 'action-token', undefined, true, 'activate'),
      input.upload('run', 'action-token', undefined, false, 'new-card')
    ]);
    expect(results.map(result => result.status)).toEqual(['fulfilled', 'rejected']);
    expect(await pending).toEqual({ values: [], useAI: false, actionId: 'activate' });
    expect(record.status).toBe('running');
    expect(record.inputRequest).toBeUndefined();
    await expect(input.upload('run', 'action-token', undefined, false, 'activate')).rejects.toThrow('no longer');
  });

  it('keeps an unauthorized submit choice open until explicitly approved', async () => {
    const { input, record } = setup();
    const pending = input.wait('run', [], 1, 'https://example.test', new AbortController().signal,
      '2099-01-01', 'Choose the action', 'consent-token', { kind: 'action',
        actions: [{ id: 'activate', label: 'Activate Existing Card', kind: 'submit' }],
        requireSubmitAuthorization: true });
    await vi.waitFor(() => expect(record.inputRequest?.kind).toBe('action'));
    await expect(input.upload('run', 'consent-token', undefined, false, 'activate'))
      .rejects.toThrow('Authorize submission');
    expect(record.status).toBe('awaiting_input');
    expect(record.inputRequest?.token).toBe('consent-token');
    await input.upload('run', 'consent-token', undefined, false, 'activate', true);
    expect(await pending).toEqual({ values: [], useAI: false, actionId: 'activate', authorizeSubmit: true });
  });

  it('stays waiting after invalid uploads and accepts only one valid upload', async () => {
    const { input, record } = setup();
    const pending = input.wait('run', fields, 1, 'https://example.test', new AbortController().signal, '2099-01-01', 'Fill');
    await vi.waitFor(() => expect(record.inputRequest).toBeDefined());
    const token = record.inputRequest!.token;
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(Uint8Array.from(input.download('run', token)).buffer);
    const file = () => book.xlsx.writeBuffer().then(buffer => ({ filename: 'step.xlsx', base64: Buffer.from(buffer).toString('base64') }));
    await expect(input.upload('run', token, await file(), false)).rejects.toThrow('required');
    expect(record.status).toBe('awaiting_input');
    book.getWorksheet('Payload')!.getCell('B2').value = 'Jamie';
    const filled = await file();
    const results = await Promise.allSettled([input.upload('run', token, filled, false), input.upload('run', token, filled, false)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect((await pending).values).toEqual([{ fieldId: 'one', value: 'Jamie' }]);
    expect(record.inputRequest).toBeUndefined();
    expect(() => input.download('run', token)).toThrow('no longer');
  });

  it.each(['abort', 'cancel', 'close'])('releases waiting runs on %s', async action => {
    const { input, record } = setup();
    const controller = new AbortController();
    const pending = input.wait('run', fields, 1, 'https://example.test', controller.signal, '2099-01-01', 'Fill');
    const rejected = expect(pending).rejects.toThrow();
    await vi.waitFor(() => expect(record.inputRequest).toBeDefined());
    if (action === 'abort') controller.abort();
    else if (action === 'cancel') input.cancel('run');
    else input.close();
    await rejected;
    expect(record.inputRequest).toBeUndefined();
  });
});

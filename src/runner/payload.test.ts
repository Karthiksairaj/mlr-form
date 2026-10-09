import { describe, expect, it, vi } from 'vitest';
import type { FormField, RunRecord } from '../types.js';
import type { RunStore } from '../storage/run-store.js';
import { withoutPayload } from '../storage/run-store.js';
import { resolvePayloadValues } from '../form/payload.js';
import { discoverBranchGroup, FormRunner } from './form-runner.js';

const npi: FormField = { id: 'field-1', name: 'npi', label: 'NPI Number *', tag: 'input', type: 'text',
  required: true, disabled: false, readOnly: false, pattern: '[0-9]{10}' };
const email: FormField = { ...npi, id: 'field-2', name: 'email', label: 'Email', type: 'email', pattern: undefined };

function setup(payload?: Record<string, string>) {
  const record = { request: { payload }, dataGeneration: undefined } as unknown as RunRecord;
  const store = { get: () => record, update: vi.fn(async (_id, update) => Object.assign(record, update)) } as unknown as RunStore;
  const generate = vi.fn(async () => [{ fieldId: email.id, value: 'test@example.test' }]);
  const runner = new FormRunner(store, { provider: 'claude', generate }, {
    allowedTargetHosts: new Set(), allowPrivateNetworks: false, headless: true, timeoutMs: 1000, formReadyTimeoutMs: 1000
  });
  return { runner, generate, record };
}

describe('payload priority', () => {
  it('matches names before labels and supports normalized labels on later steps', () => {
    expect(resolvePayloadValues([npi], { npi: '0012345678', 'NPI Number': '9999999999' })[0]?.value).toBe('0012345678');
    expect(resolvePayloadValues([{ ...npi, id: 'later-step' }], { ' npi number ': '0012345678' })[0])
      .toEqual({ fieldId: 'later-step', value: '0012345678' });
  });

  it('sends only missing fields to AI and preserves Excel values', async () => {
    const { runner, generate } = setup({ npi: '0012345678' });
    generate.mockResolvedValueOnce([{ fieldId: email.id, value: 'test@example.test' }, { fieldId: npi.id, value: '9999999999' }]);
    const values = await runner['generateValidatedValues']('run', 'basic', [npi, email], 'step-1');
    expect(values.get(npi.id)).toBe('0012345678');
    expect(generate.mock.calls[0]?.[0]).toEqual({ scenario: 'basic', fields: [email] });
  });

  it('preserves Excel values when AI fails and local fallback fills gaps', async () => {
    const { runner, generate } = setup({ npi: '0012345678' });
    generate.mockRejectedValueOnce(new Error('provider unavailable'));
    const values = await runner['generateValidatedValues']('run', 'basic', [npi, email], 'step-1');
    expect(values.get(npi.id)).toBe('0012345678');
    expect(values.get(email.id)).toBe('form.test@abbvie.com');
  });

  it('keeps supplied values while retrying invalid generated fields', async () => {
    const { runner, generate } = setup({ npi: '0012345678' });
    generate.mockResolvedValueOnce([{ fieldId: email.id, value: 'invalid-email' }]);
    const values = await runner['generateValidatedValues']('run', 'basic', [npi, email], 'step-1');
    expect(generate).toHaveBeenCalledTimes(2);
    expect(values.get(npi.id)).toBe('0012345678');
    expect(values.get(email.id)).toBe('test@example.test');
  });

  it('normalizes a model-generated RINVOQ ZIP before browser filling', async () => {
    const zip: FormField = { ...npi, id: 'zip', name: 'zipcodeADY', label: 'ZIP Code',
      autocomplete: 'zip-code', pattern: undefined, minLength: 5, maxLength: 5 };
    const { runner, generate } = setup();
    generate.mockResolvedValueOnce([{ fieldId: zip.id, value: 'K1A0B' }]);
    const values = await runner['generateValidatedValues']('run', 'generic-form', [zip], 'step-1');
    expect(values.get(zip.id)).toBe('10001');
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('normalizes a model-generated RINVOQ birth date before browser filling', async () => {
    const dob: FormField = { ...npi, id: 'dob', name: 'YourDateOfBirthAD',
      autocomplete: 'dateOfBirth', label: 'Date of Birth (MM/DD/YYYY)',
      pattern: undefined, maxLength: 10 };
    const { runner, generate } = setup();
    generate.mockResolvedValueOnce([{ fieldId: dob.id, value: '2020-01-01' }]);
    const values = await runner['generateValidatedValues']('run', 'generic-form', [dob], 'step-1');
    expect(values.get(dob.id)).toBe('01/01/1985');
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])('handles a numeric DOB mask with provider failure=%s', async providerFails => {
    const dob: FormField = { ...npi, id: 'mlr-field-5', name: 'YourDateOfBirthAD',
      label: 'Date of Birth (MM/DD/YYYY)', pattern: '[0-9]*', maxLength: 10 };
    const { runner, generate } = setup();
    if (providerFails) generate.mockRejectedValueOnce(new Error('provider unavailable'));
    else generate.mockResolvedValueOnce([{ fieldId: dob.id, value: '01/01/1985' }]);
    const values = await runner['generateValidatedValues']('run', 'generic-form', [dob], 'step-1');
    expect(values.get(dob.id)).toBe('01011985');
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('does not call AI when Excel covers every field', async () => {
    const { runner, generate } = setup({ npi: '0012345678', email: 'test@example.test' });
    const values = await runner['generateValidatedValues']('run', 'basic', [npi, email], 'step-1');
    expect(values.size).toBe(2);
    expect(generate).not.toHaveBeenCalled();
  });

  it('rejects invalid Excel values without normalization or AI replacement', async () => {
    const { runner, generate } = setup({ npi: '123' });
    await expect(runner['generateValidatedValues']('run', 'basic', [npi, email], 'step-1')).rejects.toThrow('Excel payload is invalid');
    expect(generate).not.toHaveBeenCalled();
  });

  it('rejects ambiguous field labels', () => {
    expect(() => resolvePayloadValues([npi, { ...npi, id: 'other', name: 'other' }], { 'NPI Number': '0012345678' }))
      .toThrow('ambiguous');
  });

  it('honors Excel selections in conditional branches', () => {
    const select: FormField = { ...email, name: 'condition', tag: 'select', type: 'select', options: [
      { value: 'a', label: 'Condition A' }, { value: 'b', label: 'Condition B' }
    ] };
    expect(discoverBranchGroup([select], [], { condition: 'b' })?.options).toEqual([{ value: 'b', label: 'Condition B' }]);
    const radios: FormField[] = ['Yes', 'No'].map((label, i) => ({ ...email, id: `radio-${i}`, type: 'radio', name: 'choice', label, choiceValue: label.toLowerCase() }));
    expect(discoverBranchGroup(radios, [], { choice: 'no' })?.options).toEqual([{ value: 'no', label: 'No' }]);
    expect(resolvePayloadValues(radios, { No: 'true' })).toEqual([
      { fieldId: 'radio-1', value: 'true' }, { fieldId: 'radio-0', value: 'false' }
    ]);
  });

  it('omits payload values from public and persisted metadata', () => {
    const { record } = setup({ npi: '0012345678' });
    expect(withoutPayload(record).request.payload).toBeUndefined();
    expect(record.request.payload?.npi).toBe('0012345678');
  });
});

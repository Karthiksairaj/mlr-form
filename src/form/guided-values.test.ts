import { describe, expect, it } from 'vitest';
import type { FormField } from '../types.js';
import { fieldMemoryKey, retainedValues } from './guided-values.js';

function field(overrides: Partial<FormField> = {}): FormField {
  return { id: 'mlr-field-0', tag: 'input', type: 'text', label: 'NPI Number',
    required: true, disabled: false, readOnly: false, ...overrides };
}

describe('answers retained within a form step', () => {
  it.each([
    { domId: 'authored-npi', name: 'runtime-npi' },
    { name: 'npi' },
    {}
  ])('reuses an answer when extraction IDs shift with identity %j', identity => {
    const original = field(identity);
    const memory = new Map([[fieldMemoryKey(original), '0012345678']]);
    const revealed = field({ id: 'mlr-field-0', name: 'cardType', label: 'Card Type' });
    const shifted = { ...original, id: 'mlr-field-1' };
    expect(retainedValues([revealed, shifted], memory)).toEqual(new Map([['mlr-field-1', '0012345678']]));
  });

  it('uses authored IDs when a runtime changes field names', () => {
    const original = field({ domId: 'npi', name: 'generated-101' });
    const memory = new Map([[fieldMemoryKey(original), '0012345678']]);
    expect(retainedValues([field({ id: 'new-id', domId: 'npi', name: 'generated-202' })], memory))
      .toEqual(new Map([['new-id', '0012345678']]));
  });

  it.each(['radio', 'checkbox'])('keeps %s option answers distinct within one named group', type => {
    const yes = field({ id: 'yes', type, name: 'eligibility', label: 'Eligible', choiceValue: 'yes' });
    const no = field({ id: 'no', type, name: 'eligibility', label: 'Eligible', choiceValue: 'no' });
    const memory = new Map([[fieldMemoryKey(yes), 'true'], [fieldMemoryKey(no), 'false']]);
    expect(retainedValues([{ ...no, id: 'new-no' }, { ...yes, id: 'new-yes' }], memory))
      .toEqual(new Map([['new-no', 'false'], ['new-yes', 'true']]));
  });

  it.each([{ options: [] }, { options: [{ value: 'savings', label: 'Savings card' }] }])('does not reuse a select answer after the option disappears: %j', ({ options }) => {
    const select = field({ tag: 'select', type: 'select', name: 'cardType', options: [
      { value: 'savings', label: 'Savings card' }, { value: 'existing', label: 'Existing card' }
    ] });
    const memory = new Map([[fieldMemoryKey(select), 'existing']]);
    expect(retainedValues([{ ...select, id: 'updated', options }], memory).size).toBe(0);
    expect(retainedValues([{ ...select, id: 'updated' }], memory)).toEqual(new Map([['updated', 'existing']]));
  });

  it('does not apply an ambiguous remembered answer to duplicate controls', () => {
    const original = field({ name: 'npi' });
    const memory = new Map([[fieldMemoryKey(original), '0012345678']]);
    expect(retainedValues([{ ...original, id: 'first' }, { ...original, id: 'second' }], memory).size).toBe(0);
  });

  it('keeps fields with duplicate labels separate when authored IDs identify them', () => {
    const first = field({ id: 'first', domId: 'provider-npi' });
    const second = field({ id: 'second', domId: 'practice-npi' });
    const memory = new Map([[fieldMemoryKey(first), '0012345678'], [fieldMemoryKey(second), '0098765432']]);
    expect(retainedValues([first, second], memory))
      .toEqual(new Map([['first', '0012345678'], ['second', '0098765432']]));
  });
});

import { describe, expect, it } from 'vitest';
import { DeterministicDataGenerator } from './deterministic-data-generator.js';
import type { FormField } from '../types.js';

const base = {
  tag: 'input' as const,
  required: true,
  disabled: false,
  readOnly: false
};

describe('DeterministicDataGenerator', () => {
  it('generates repeatable values for common P1/P2 fields', async () => {
    const fields: FormField[] = [
      { ...base, id: 'first', type: 'text', label: 'First name' },
      { ...base, id: 'email', type: 'email', label: 'Email' },
      { ...base, id: 'zip', type: 'text', label: 'ZIP code', pattern: '[0-9]{5}' },
      {
        ...base,
        id: 'state',
        tag: 'select',
        type: 'select',
        label: 'State',
        options: [{ value: '', label: 'Choose' }, { value: 'NY', label: 'New York' }]
      }
    ];
    const generator = new DeterministicDataGenerator();
    await expect(generator.generate({ scenario: 'basic', fields })).resolves.toEqual([
      { fieldId: 'first', value: 'Jamie' },
      { fieldId: 'email', value: 'form.test@abbvie.com' },
      { fieldId: 'zip', value: '10001' },
      { fieldId: 'state', value: 'NY' }
    ]);
  });

  it('selects one option from a checkbox group and checks standalone boxes', async () => {
    const fields: FormField[] = [
      { ...base, required: false, id: 'symptom-1', name: 'symptoms', type: 'checkbox', label: 'Constipation' },
      { ...base, required: false, id: 'symptom-2', name: 'symptoms', type: 'checkbox', label: 'Bloating' },
      { ...base, required: false, id: 'marketing', name: 'marketing', type: 'checkbox', label: 'Marketing consent' }
    ];
    const generator = new DeterministicDataGenerator();
    await expect(generator.generate({ scenario: 'quiz', fields })).resolves.toEqual([
      { fieldId: 'symptom-1', value: 'true' },
      { fieldId: 'symptom-2', value: 'false' },
      { fieldId: 'marketing', value: 'true' }
    ]);
  });

  it('uses the displayed format for adult and child birth dates', async () => {
    const adult: FormField = { ...base, id: 'adult-dob', type: 'text',
      label: 'Date of Birth (MM/DD/YYYY)', name: 'YourDateOfBirthAD' };
    const child: FormField = { ...base, id: 'child-dob', type: 'text',
      label: "Child's Date of Birth (MM/DD/YYYY)" };
    const generator = new DeterministicDataGenerator();
    expect(await generator.generate({ scenario: 'basic', fields: [adult, child] })).toEqual([
      { fieldId: adult.id, value: '01/01/1985' },
      { fieldId: child.id, value: `01/01/${new Date().getUTCFullYear() - 10}` }
    ]);
  });
});

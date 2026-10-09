import { describe, expect, it } from 'vitest';
import { conformGeneratedValues, validateGeneratedValues } from './field-validation.js';
import type { FormField } from '../types.js';

const fields: FormField[] = [
  {
    id: 'email',
    tag: 'input',
    type: 'email',
    label: 'Email',
    required: true,
    disabled: false,
    readOnly: false
  },
  {
    id: 'state',
    tag: 'select',
    type: 'select',
    label: 'State',
    required: true,
    disabled: false,
    readOnly: false,
    options: [{ value: 'NY', label: 'New York' }]
  }
];

describe('validateGeneratedValues', () => {
  it.each(['[0-9]*', '[0-9]{8}', '\\d{8}'])('validates a numeric DOB mask %s without losing date semantics', pattern => {
    const dob: FormField = { id: 'mlr-field-5', tag: 'input', type: 'text',
      label: 'Date of Birth (MM/DD/YYYY)', name: 'YourDateOfBirthAD', pattern,
      maxLength: 10, required: true, disabled: false, readOnly: false };
    const normalized = conformGeneratedValues([dob], [{ fieldId: dob.id, value: '01/01/1985' }]);
    expect(normalized.values).toEqual([{ fieldId: dob.id, value: '01011985' }]);
    expect(validateGeneratedValues([dob], normalized.values).errors).toEqual([]);
    expect(validateGeneratedValues([dob], [{ fieldId: dob.id, value: '02301985' }]).errors)
      .toContain(`${dob.id}: date of birth is not a calendar date`);
    expect(validateGeneratedValues([dob], [{ fieldId: dob.id, value: '11111' }]).errors)
      .toContain(`${dob.id}: date of birth must use MMDDYYYY`);
  });
  it('requires an answer for a required checkbox group without requiring every option', () => {
    const choices: FormField[] = ['Constipation', 'Bloating'].map((label, index) => ({
      id: `symptom-${index}`, tag: 'input', type: 'checkbox', name: 'symptoms', label,
      groupRequired: true, required: false, disabled: false, readOnly: false
    }));
    expect(validateGeneratedValues(choices, choices.map(item => ({ fieldId: item.id, value: 'false' }))).errors)
      .toContain('symptoms: required checkbox group needs at least one selected value');
    expect(validateGeneratedValues(choices, [
      { fieldId: 'symptom-0', value: 'true' }, { fieldId: 'symptom-1', value: 'false' }
    ]).errors).toEqual([]);
  });
  it('normalizes AI output for a flexible numeric-only HTML pattern', () => {
    const numericField: FormField = {
      id: 'numeric',
      tag: 'input',
      type: 'tel',
      label: 'Mobile phone',
      pattern: '[0-9]*',
      required: true,
      disabled: false,
      readOnly: false
    };
    const conformed = conformGeneratedValues([numericField], [
      { fieldId: 'numeric', value: '(202) 555-0147' }
    ]);

    expect(conformed).toEqual({
      values: [{ fieldId: 'numeric', value: '2025550147' }],
      changedCount: 1
    });
    expect(validateGeneratedValues([numericField], conformed.values).errors).toEqual([]);
  });

  it('uses a known US ZIP when the site supplies length but no numeric pattern', () => {
    const zip: FormField = {
      id: 'zip', name: 'zipcodeADY', autocomplete: 'zip-code', tag: 'input', type: 'text',
      label: 'ZIP Code', minLength: 5, maxLength: 5,
      required: true, disabled: false, readOnly: false
    };
    expect(validateGeneratedValues([zip], [{ fieldId: 'zip', value: 'A1B2C' }]).errors)
      .toContain('zip: enter a five-digit US ZIP code');
    expect(conformGeneratedValues([zip], [{ fieldId: 'zip', value: 'A1B2C' }]))
      .toEqual({ values: [{ fieldId: 'zip', value: '10001' }], changedCount: 1 });
    expect(conformGeneratedValues([zip], [{ fieldId: 'zip', value: '12345' }]).values[0]?.value)
      .toBe('10001');
    expect(validateGeneratedValues([zip], [{ fieldId: 'zip', value: '10001' }]).errors).toEqual([]);
  });

  it('does not replace non-US postal codes or ZIP+4 fields', () => {
    const postal: FormField = { id: 'postal', tag: 'input', type: 'text', label: 'Postal code',
      required: true, disabled: false, readOnly: false };
    const zip4: FormField = { ...postal, id: 'zip4', label: 'ZIP+4', minLength: 9, maxLength: 10 };
    expect(conformGeneratedValues([postal, zip4], [
      { fieldId: 'postal', value: 'K1A 0B1' }, { fieldId: 'zip4', value: '10001-1234' }
    ]).values).toEqual([
      { fieldId: 'postal', value: 'K1A 0B1' }, { fieldId: 'zip4', value: '10001-1234' }
    ]);
  });

  it('formats RINVOQ text birth dates and rejects invalid or underage dates', () => {
    const dob: FormField = { id: 'dob', name: 'YourDateOfBirthAD', autocomplete: 'dateOfBirth',
      tag: 'input', type: 'text', label: 'Date of Birth (MM/DD/YYYY)', maxLength: 10,
      required: true, disabled: false, readOnly: false };
    expect(conformGeneratedValues([dob], [{ fieldId: 'dob', value: '2020-01-01' }]).values)
      .toEqual([{ fieldId: 'dob', value: '01/01/1985' }]);
    expect(validateGeneratedValues([dob], [{ fieldId: 'dob', value: '2020-01-01' }]).errors)
      .toContain('dob: date of birth must use MM/DD/YYYY');
    expect(validateGeneratedValues([dob], [{ fieldId: 'dob', value: '02/30/1985' }]).errors)
      .toContain('dob: date of birth is not a calendar date');
    const underage = `01/01/${new Date().getUTCFullYear() - 10}`;
    expect(validateGeneratedValues([dob], [{ fieldId: 'dob', value: underage }]).errors)
      .toContain('dob: date of birth must be at least 18 years ago');
    expect(validateGeneratedValues([dob], [{ fieldId: 'dob', value: '01/01/1985' }]).errors).toEqual([]);
  });

  it('keeps native birth dates in ISO format and treats child birth dates separately', () => {
    const native: FormField = { id: 'native-dob', tag: 'input', type: 'date', label: 'Date of Birth',
      required: true, disabled: false, readOnly: false };
    const child: FormField = { ...native, id: 'child-dob', type: 'text',
      label: "Child's Date of Birth (MM/DD/YYYY)" };
    const childYear = new Date().getUTCFullYear() - 10;
    expect(conformGeneratedValues([native, child], [
      { fieldId: native.id, value: '1985-01-01' }, { fieldId: child.id, value: 'invalid' }
    ]).values).toEqual([
      { fieldId: native.id, value: '1985-01-01' },
      { fieldId: child.id, value: `01/01/${childYear}` }
    ]);
    expect(validateGeneratedValues([child], [{ fieldId: child.id, value: `01/01/${childYear}` }]).errors)
      .toEqual([]);
  });

  it('accepts valid generated values', () => {
    const result = validateGeneratedValues(fields, [
      { fieldId: 'email', value: 'jamie@example.test' },
      { fieldId: 'state', value: 'NY' }
    ]);
    expect(result.errors).toEqual([]);
  });

  it('rejects unknown, missing, and invalid values', () => {
    const result = validateGeneratedValues(fields, [
      { fieldId: 'email', value: 'not-an-email' },
      { fieldId: 'unexpected', value: 'value' }
    ]);
    expect(result.errors).toEqual(expect.arrayContaining([
      'Unknown field ID: unexpected',
      'email: invalid email address',
      'state: generated value is missing'
    ]));
  });

  it('requires complete output and exactly one required radio choice', () => {
    const radioFields: FormField[] = [
      { id: 'yes', name: 'answer', tag: 'input', type: 'radio', label: 'Yes', required: true, disabled: false, readOnly: false },
      { id: 'no', name: 'answer', tag: 'input', type: 'radio', label: 'No', required: true, disabled: false, readOnly: false }
    ];
    const result = validateGeneratedValues(radioFields, [
      { fieldId: 'yes', value: 'true' },
      { fieldId: 'no', value: 'true' }
    ]);
    expect(result.errors).toContain('answer: radio group has more than one selected value');
  });
});

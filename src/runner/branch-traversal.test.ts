import { describe, expect, it } from 'vitest';
import type { FormField } from '../types.js';
import { discoverBranchGroup, type BranchChoice } from './form-runner.js';

function field(overrides: Partial<FormField>): FormField {
  return {
    id: overrides.id ?? 'field',
    tag: overrides.tag ?? 'input',
    type: overrides.type ?? 'text',
    label: overrides.label ?? 'Field',
    required: overrides.required ?? true,
    disabled: overrides.disabled ?? false,
    readOnly: overrides.readOnly ?? false,
    ...overrides
  };
}

describe('recursive branch discovery', () => {
  it('discovers every non-placeholder option from an exclusive select', () => {
    const group = discoverBranchGroup([field({
      id: 'condition',
      tag: 'select',
      type: 'select',
      name: 'condition',
      label: 'Condition',
      options: [
        { value: '', label: 'Select a condition' },
        { value: 'eczema', label: 'Eczema' },
        { value: 'arthritis', label: 'Arthritis' }
      ]
    })], []);

    expect(group?.kind).toBe('select');
    expect(group?.options.map(option => option.label)).toEqual(['Eczema', 'Arthritis']);
  });

  it('ignores an answered parent and discovers the next radio group', () => {
    const parent: BranchChoice = {
      kind: 'select',
      groupKey: 'select:condition',
      label: 'Eczema',
      value: 'eczema'
    };
    const fields = [
      field({ id: 'condition', tag: 'select', type: 'select', name: 'condition', label: 'Condition' }),
      field({ id: 'yes', type: 'radio', name: 'prescribed', label: 'Yes' }),
      field({ id: 'no', type: 'radio', name: 'prescribed', label: 'No' })
    ];

    const group = discoverBranchGroup(fields, [parent]);
    expect(group?.kind).toBe('radio');
    expect(group?.options.map(option => option.label)).toEqual(['Yes', 'No']);
  });

  it('preserves authored radio values while using visible Yes/No labels', () => {
    const group = discoverBranchGroup([
      field({ id: 'yes', type: 'radio', name: 'registrationType', label: 'Yes', choiceValue: 'Registration' }),
      field({ id: 'no', type: 'radio', name: 'registrationType', label: 'No', choiceValue: 'DSARegistration' })
    ], []);

    expect(group?.options).toEqual([
      { label: 'Yes', value: 'Registration' },
      { label: 'No', value: 'DSARegistration' }
    ]);
  });

  it('does not branch ordinary selects once leaf data fields are visible', () => {
    const fields = [
      field({ id: 'state', tag: 'select', type: 'select', name: 'state', label: 'State', options: [
        { value: 'IL', label: 'Illinois' },
        { value: 'NY', label: 'New York' }
      ] }),
      field({ id: 'email', type: 'email', name: 'email', label: 'Email' })
    ];

    expect(discoverBranchGroup(fields, [])).toBeUndefined();
  });

  it('discovers a checkbox-rendered multi-option branch', () => {
    const group = discoverBranchGroup([
      field({ id: 'yes', type: 'checkbox', name: 'answer', label: 'Yes' }),
      field({ id: 'no', type: 'checkbox', name: 'answer', label: 'No' })
    ], []);

    expect(group?.kind).toBe('checkbox');
    expect(group?.options.map(option => option.label)).toEqual(['Yes', 'No']);
  });
});

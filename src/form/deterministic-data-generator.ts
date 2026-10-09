import type { DataGenerator } from '../claude/data-generator.js';
import type { FormField, GeneratedValue } from '../types.js';
import { birthDateFormat, isUsZipField } from './field-validation.js';

function fitLength(value: string, field: FormField): string {
  let result = value;
  if (field.maxLength !== undefined && field.maxLength >= 0) {
    result = result.slice(0, field.maxLength);
  }
  if (field.minLength !== undefined && result.length < field.minLength) {
    result = result.padEnd(field.minLength, 'x');
  }
  return result;
}

function digitsForPattern(pattern?: string): string | undefined {
  if (!pattern) return undefined;
  const match = pattern.match(/(?:\\d|\[0-9\])\{(\d+)\}/u);
  return match?.[1] ? '1'.repeat(Number(match[1])) : undefined;
}

function valueForField(
  field: FormField,
  selectedRadioGroups: Set<string>,
  selectedCheckboxGroups: Set<string>,
  checkboxGroupCounts: Map<string, number>
): string {
  const label = `${field.label} ${field.name ?? ''} ${field.autocomplete ?? ''}`.toLowerCase();
  if (isUsZipField(field)) return '10001';
  const dobFormat = birthDateFormat(field);
  if (dobFormat) {
    const year = /\bchild(?:'s)?\b|\bminor\b|\bdependent\b/iu.test(label)
      ? new Date().getUTCFullYear() - 10 : 1985;
    const formatted = dobFormat.startsWith('iso') ? `${year}-01-01` : `01/01/${year}`;
    return dobFormat.endsWith('-digits') ? formatted.replace(/\D/gu, '') : formatted;
  }
  const patternedDigits = digitsForPattern(field.pattern);
  if (patternedDigits) return patternedDigits;

  if (field.tag === 'select') {
    const option = field.options?.find(item => item.value.trim() !== '') ?? field.options?.[0];
    return option?.value ?? '';
  }
  if (field.type === 'checkbox') {
    if (field.required) return 'true';
    const group = field.name ?? field.id;
    // A standalone checkbox is normally an acknowledgement or opt-in that is
    // part of completing the form, so include it in the filled-state evidence.
    // For a checkbox group, choose only the first option to avoid selecting
    // every answer in a multi-select question.
    if ((checkboxGroupCounts.get(group) ?? 0) <= 1) return 'true';
    if (selectedCheckboxGroups.has(group)) return 'false';
    selectedCheckboxGroups.add(group);
    return 'true';
  }
  if (field.type === 'radio') {
    const group = field.name ?? field.id;
    if (selectedRadioGroups.has(group)) return 'false';
    selectedRadioGroups.add(group);
    return 'true';
  }
  if (field.type === 'email' || label.includes('email')) return 'form.test@abbvie.com';
  if (field.type === 'tel' || label.includes('phone')) return '2025550147';
  if (field.type === 'url' || label.includes('website')) return 'https://example.test';
  if (field.type === 'date') return field.min || field.max || '2000-01-01';
  if (field.type === 'month') return '2000-01';
  if (field.type === 'time') return '10:30';
  if (field.type === 'number' || field.type === 'range') return field.min || '1';
  if (field.type === 'color') return '#005ea8';
  if (field.type === 'password') return fitLength('TestForm123!', field);
  if (label.includes('first') && label.includes('name')) return fitLength('Jamie', field);
  if (label.includes('last') && label.includes('name')) return fitLength('Taylor', field);
  if (label.includes('full name') || label === 'name') return fitLength('Jamie Taylor', field);
  if (label.includes('zip') || label.includes('postal')) return fitLength('10001', field);
  if (label.includes('city')) return fitLength('New York', field);
  if (label.includes('address')) return fitLength('100 Test Avenue', field);
  if (label.includes('company') || label.includes('organization')) return fitLength('Example Test Organization', field);
  if (label.includes('npi')) return fitLength('1234567893', field);
  return fitLength('Test value', field);
}

/**
 * Deterministic P1/P2 generator and resilient fallback for P5 providers.
 */
export class DeterministicDataGenerator implements DataGenerator {
  readonly provider = 'local' as const;

  async generate(input: { fields: FormField[] }): Promise<GeneratedValue[]> {
    const selectedRadioGroups = new Set<string>();
    const selectedCheckboxGroups = new Set<string>();
    const checkboxGroupCounts = new Map<string, number>();
    for (const field of input.fields) {
      if (field.type !== 'checkbox') continue;
      const group = field.name ?? field.id;
      checkboxGroupCounts.set(group, (checkboxGroupCounts.get(group) ?? 0) + 1);
    }
    return input.fields
      .filter(field => !field.disabled && !field.readOnly && !['hidden', 'submit', 'button', 'file'].includes(field.type))
      .map(field => ({
        fieldId: field.id,
        value: valueForField(field, selectedRadioGroups, selectedCheckboxGroups, checkboxGroupCounts)
      }));
  }
}

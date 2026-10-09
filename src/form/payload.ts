import type { FormField, GeneratedValue } from '../types.js';
import { validateGeneratedValues } from './field-validation.js';

export function normalizePayloadKey(key: string): string {
  return key.trim().replace(/\s+/gu, ' ').replace(/\s*\*$/u, '').toLowerCase();
}

/** Match stable authored names, then visible labels, across every form step. */
export function resolvePayloadValues(fields: FormField[], payload: Record<string, string> = {}): GeneratedValue[] {
  const entries = new Map(Object.entries(payload).map(([key, value]) => [normalizePayloadKey(key), value]));
  const values = new Map<string, string>();
  const editable = fields.filter(field => !field.disabled && !field.readOnly &&
    !['hidden', 'submit', 'button', 'file'].includes(field.type));
  for (const field of editable) {
    const name = field.name ? normalizePayloadKey(field.name) : undefined;
    const label = normalizePayloadKey(field.label);
    const key = name && entries.has(name) ? name : label;
    if (!entries.has(key)) continue;
    const value = entries.get(key)!;
    const siblings = editable.filter(candidate => name && key === name
      ? normalizePayloadKey(candidate.name ?? '') === name
      : normalizePayloadKey(candidate.label) === label);
    if (siblings.length > 1) {
      if (!siblings.every(candidate => candidate.type === field.type && ['radio', 'checkbox'].includes(candidate.type))) {
        throw new Error(`Excel payload field "${key}" is ambiguous. Use a unique form field name.`);
      }
      const selected = siblings.filter(candidate => candidate.choiceValue === value || candidate.label === value);
      if (selected.length !== 1) throw new Error(`Excel payload field "${key}" must identify one available option.`);
      values.set(field.id, selected[0]!.id === field.id ? 'true' : 'false');
    } else {
      values.set(field.id, value);
    }
  }
  // Selecting a radio by its unique label also clears the rest of its group.
  for (const field of editable.filter(candidate => candidate.type === 'radio' && values.get(candidate.id) === 'true')) {
    for (const sibling of editable.filter(candidate => candidate.type === 'radio' && candidate.name && candidate.name === field.name)) {
      if (!values.has(sibling.id)) values.set(sibling.id, 'false');
    }
  }
  const result = [...values].map(([fieldId, value]) => ({ fieldId, value }));
  const validation = validateGeneratedValues(editable.filter(field => values.has(field.id)), result);
  if (validation.errors.length) throw new Error(`Excel payload is invalid: ${validation.errors.join('; ')}`);
  return result;
}

import type { FormField } from '../types.js';

/** Unlike extraction IDs, these keys survive controls inserted earlier in the DOM. */
export function fieldMemoryKey(field: FormField): string {
  return JSON.stringify([field.tag, field.type, field.domId || field.name || field.label,
    ['checkbox', 'radio'].includes(field.type) ? field.choiceValue ?? field.label : '']);
}

export function retainedValues(fields: FormField[], memory: Map<string, string>): Map<string, string> {
  const counts = new Map<string, number>();
  for (const field of fields) {
    const key = fieldMemoryKey(field);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new Map(fields.flatMap(field => {
    const key = fieldMemoryKey(field);
    const value = memory.get(key);
    if (value === undefined || counts.get(key) !== 1) return [];
    if (field.tag === 'select' && value !== '' && !field.options?.some(option => option.value === value || option.label === value)) return [];
    return [[field.id, value]];
  }));
}

import type { FormField, GeneratedValue } from '../types.js';

export type FieldValidationResult = {
  values: Map<string, string>;
  errors: string[];
};

function numericPatternBounds(pattern?: string): { minimum: number; maximum?: number } | undefined {
  if (!pattern) return undefined;
  const normalized = pattern.trim().replace(/^\^/u, '').replace(/\$$/u, '');
  const match = normalized.match(/^(?:\[0-9\]|\\d)(\*|\+|\{(\d+)(?:,(\d*))?\})?$/u);
  if (!match) return undefined;
  if (!match[1]) return { minimum: 1, maximum: 1 };
  if (match[1] === '*') return { minimum: 0 };
  if (match[1] === '+') return { minimum: 1 };
  const minimum = Number(match[2]);
  const maximum = match[3] === undefined
    ? minimum
    : match[3] === ''
      ? undefined
      : Number(match[3]);
  return { minimum, ...(maximum === undefined ? {} : { maximum }) };
}

export function isUsZipField(field: FormField): boolean {
  if (field.tag === 'select' || ['checkbox', 'radio'].includes(field.type)) return false;
  const identity = `${field.label} ${field.name ?? ''} ${field.autocomplete ?? ''} ${field.domId ?? ''}`;
  const bounds = numericPatternBounds(field.pattern);
  return /\bzip[\s-]?(?:code)?\b|zipcode/iu.test(identity) &&
    !/zip\s*\+\s*4|zip[\s-]?4/iu.test(identity) &&
    (field.maxLength === undefined || field.maxLength >= 5) &&
    (field.minLength === undefined || field.minLength <= 5) &&
    (!bounds || (bounds.minimum <= 5 && (bounds.maximum === undefined || bounds.maximum >= 5)));
}

type BirthDateFormat = 'iso' | 'us' | 'iso-digits' | 'us-digits';

export function birthDateFormat(field: FormField): BirthDateFormat | undefined {
  if (field.tag !== 'input' || !['text', 'tel', 'date', 'number'].includes(field.type)) return undefined;
  const identity = `${field.label} ${field.name ?? ''} ${field.autocomplete ?? ''} ${field.domId ?? ''}`;
  if (!/date\s*of\s*birth|birth\s*date|\bdob\b|dateofbirth/iu.test(identity)) return undefined;
  if (field.type === 'date') return 'iso';
  const order = /YYYY[-/]MM[-/]DD/iu.test(field.label) ? 'iso' : 'us';
  // Masked text widgets may advertise MM/DD/YYYY but accept only the eight
  // digits. Preserve the date order while honoring the actual input pattern.
  return numericPatternBounds(field.pattern) ? `${order}-digits` : order;
}

function isChildBirthDate(field: FormField): boolean {
  return /\bchild(?:'s)?\b|\bminor\b|\bdependent\b/iu.test(`${field.label} ${field.name ?? ''}`);
}

function birthDateError(field: FormField, value: string, format: BirthDateFormat): string | undefined {
  const formats = {
    iso: { pattern: /^(\d{4})-(\d{2})-(\d{2})$/u, label: 'YYYY-MM-DD' },
    us: { pattern: /^(\d{2})\/(\d{2})\/(\d{4})$/u, label: 'MM/DD/YYYY' },
    'iso-digits': { pattern: /^(\d{4})(\d{2})(\d{2})$/u, label: 'YYYYMMDD' },
    'us-digits': { pattern: /^(\d{2})(\d{2})(\d{4})$/u, label: 'MMDDYYYY' }
  };
  const match = formats[format].pattern.exec(value);
  if (!match) return `${field.id}: date of birth must use ${formats[format].label}`;
  const iso = format.startsWith('iso');
  const year = Number(match[iso ? 1 : 3]);
  const month = Number(match[iso ? 2 : 1]);
  const day = Number(match[iso ? 3 : 2]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return `${field.id}: date of birth is not a calendar date`;
  }
  if (date > new Date()) return `${field.id}: date of birth cannot be in the future`;
  if (!isChildBirthDate(field)) {
    const today = new Date();
    const adultCutoff = new Date(Date.UTC(today.getUTCFullYear() - 18, today.getUTCMonth(), today.getUTCDate()));
    if (date > adultCutoff) return `${field.id}: date of birth must be at least 18 years ago`;
  }
  return undefined;
}

/**
 * Models are used for semantic test data, but deterministic browser constraints
 * must always win. For numeric-only HTML patterns, remove formatting and pad or
 * trim to a permitted length before the strict validation pass.
 */
export function conformGeneratedValues(
  fields: FormField[],
  generated: GeneratedValue[]
): { values: GeneratedValue[]; changedCount: number } {
  const fieldById = new Map(fields.map(field => [field.id, field]));
  let changedCount = 0;
  const values = generated.map(item => {
    const field = fieldById.get(item.fieldId);
    const dobFormat = field ? birthDateFormat(field) : undefined;
    if (field && dobFormat) {
      const year = isChildBirthDate(field) ? new Date().getUTCFullYear() - 10 : 1985;
      const formatted = dobFormat.startsWith('iso') ? `${year}-01-01` : `01/01/${year}`;
      const value = dobFormat.endsWith('-digits') ? formatted.replace(/\D/gu, '') : formatted;
      if (item.value === value) return item;
      changedCount += 1;
      return { ...item, value };
    }
    // The site may check a ZIP against an address database despite exposing
    // only min/max length in HTML. Use a known US ZIP for synthetic AI data.
    if (field && isUsZipField(field)) {
      if (item.value === '10001') return item;
      changedCount += 1;
      return { ...item, value: '10001' };
    }
    const bounds = numericPatternBounds(field?.pattern);
    if (!field || !bounds) return item;

    let value = item.value.replace(/\D/gu, '');
    const semanticLength = /(?:phone|mobile|npi)/iu.test(field.label)
      ? 10
      : /(?:zip|postal)/iu.test(field.label)
        ? 5
        : undefined;
    const requiredMinimum = Math.max(bounds.minimum, field.minLength ?? 0, field.required ? 1 : 0);
    const desiredLength = value.length > 0
      ? value.length
      : semanticLength ?? requiredMinimum;
    const maximum = Math.min(bounds.maximum ?? Number.POSITIVE_INFINITY, field.maxLength ?? Number.POSITIVE_INFINITY);
    const targetLength = Math.max(requiredMinimum, Math.min(desiredLength, maximum));
    value = value.slice(0, targetLength).padEnd(targetLength, '1');

    if (value === item.value) return item;
    changedCount += 1;
    return { ...item, value };
  });
  return { values, changedCount };
}

export function validateGeneratedValues(
  fields: FormField[],
  generated: GeneratedValue[]
): FieldValidationResult {
  const fieldById = new Map(fields.map(field => [field.id, field]));
  const values = new Map<string, string>();
  const errors: string[] = [];

  for (const item of generated) {
    const field = fieldById.get(item.fieldId);
    if (!field) {
      errors.push(`Unknown field ID: ${item.fieldId}`);
      continue;
    }
    if (values.has(item.fieldId)) {
      errors.push(`Duplicate value for field: ${item.fieldId}`);
      continue;
    }
    values.set(item.fieldId, item.value);
  }

  for (const field of fields) {
    if (field.disabled || field.readOnly || ['hidden', 'submit', 'button', 'file'].includes(field.type)) {
      continue;
    }
    const value = values.get(field.id);
    if (value === undefined) {
      errors.push(`${field.id}: generated value is missing`);
      continue;
    }
    if (field.required && value.trim() === '') {
      errors.push(`${field.id}: required value is missing`);
      continue;
    }
    if (value === '') continue;
    const dobFormat = birthDateFormat(field);
    if (dobFormat) {
      const dobError = birthDateError(field, value, dobFormat);
      if (dobError) errors.push(dobError);
    }
    if (isUsZipField(field) && !/^\d{5}$/u.test(value)) {
      errors.push(`${field.id}: enter a five-digit US ZIP code`);
    }
    if (field.minLength !== undefined && value.length < field.minLength) {
      errors.push(`${field.id}: must contain at least ${field.minLength} characters`);
    }
    if (field.maxLength !== undefined && value.length > field.maxLength) {
      errors.push(`${field.id}: must contain no more than ${field.maxLength} characters`);
    }
    if (field.pattern) {
      try {
        if (!new RegExp(`^(?:${field.pattern})$`, 'u').test(value)) {
          errors.push(`${field.id}: does not match pattern ${field.pattern}`);
        }
      } catch {
        // Browsers may support pattern syntax that the Node runtime does not.
      }
    }
    if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)) {
      errors.push(`${field.id}: invalid email address`);
    }
    if (field.type === 'url') {
      try {
        new URL(value);
      } catch {
        errors.push(`${field.id}: invalid URL`);
      }
    }
    if (field.type === 'number' && !Number.isFinite(Number(value))) {
      errors.push(`${field.id}: invalid number`);
    }
    if (field.type === 'number' && Number.isFinite(Number(value))) {
      if (field.min !== undefined && Number(value) < Number(field.min)) {
        errors.push(`${field.id}: must be at least ${field.min}`);
      }
      if (field.max !== undefined && Number(value) > Number(field.max)) {
        errors.push(`${field.id}: must be no more than ${field.max}`);
      }
    }
    if (field.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
      errors.push(`${field.id}: invalid date; expected YYYY-MM-DD`);
    }
    if (field.type === 'date' && field.min !== undefined && value < field.min) {
      errors.push(`${field.id}: date must be on or after ${field.min}`);
    }
    if (field.type === 'date' && field.max !== undefined && value > field.max) {
      errors.push(`${field.id}: date must be on or before ${field.max}`);
    }
    if (field.type === 'checkbox' && field.required && value !== 'true') {
      errors.push(`${field.id}: required checkbox must be true`);
    }
    if (['checkbox', 'radio'].includes(field.type) && !['true', 'false'].includes(value)) {
      errors.push(`${field.id}: ${field.type} value must be true or false`);
    }
    if (field.options?.length) {
      const allowed = field.options.flatMap(option => [option.value, option.label]);
      if (!allowed.includes(value)) {
        errors.push(`${field.id}: value is not one of the supplied options`);
      }
    }
  }

  const radioGroups = new Map<string, FormField[]>();
  for (const field of fields.filter(candidate => candidate.type === 'radio')) {
    const group = field.name ?? field.id;
    radioGroups.set(group, [...(radioGroups.get(group) ?? []), field]);
  }
  for (const [group, groupFields] of radioGroups) {
    const selectedCount = groupFields.filter(field => values.get(field.id) === 'true').length;
    if (selectedCount > 1) errors.push(`${group}: radio group has more than one selected value`);
    if (groupFields.some(field => field.required) && selectedCount !== 1) {
      errors.push(`${group}: required radio group must have exactly one selected value`);
    }
  }

  const checkboxGroups = new Map<string, FormField[]>();
  for (const field of fields.filter(candidate => candidate.type === 'checkbox' && candidate.groupRequired)) {
    const group = field.name ?? field.id;
    checkboxGroups.set(group, [...(checkboxGroups.get(group) ?? []), field]);
  }
  for (const [group, groupFields] of checkboxGroups) {
    if (!groupFields.some(field => values.get(field.id) === 'true')) {
      errors.push(`${group}: required checkbox group needs at least one selected value`);
    }
  }

  return { values, errors };
}

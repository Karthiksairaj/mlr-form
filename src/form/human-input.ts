import type { FormField, GeneratedValue } from '../types.js';
import { validateGeneratedValues } from './field-validation.js';
import { ExcelPayloadError } from './excel-payload.js';

function isEmailField(field: FormField): boolean {
  return field.tag === 'input' && (field.type === 'email' ||
    (field.type === 'text' && /e.?mail/iu.test(`${field.label} ${field.name ?? ''} ${field.autocomplete ?? ''}`)));
}

/** A confirmation email is only useful when its matching address is supplied too. */
export function pairedEmailFields(fields: FormField[]): FormField[] {
  const emails = fields.filter(isEmailField);
  return emails.length > 1 && emails.some(field => /verif|confirm|re.?enter|repeat/iu.test(`${field.label} ${field.name ?? ''}`))
    ? emails : [];
}

export function isVerifiedField(field: FormField, verificationFlow = false): boolean {
  const text = `${field.label} ${field.name ?? ''} ${field.domId ?? ''} ${field.autocomplete ?? ''} ${field.placeholder ?? ''}`;
  if (/npi|national.?provider|(?:card|member|activation).*(?:number|num|id|code)|(?:number|id|code).*(?:card|activation)|otp|one.?time|verification|authentication|passcode|password|security.?code/iu.test(text) || field.type === 'password') return true;
  if (field.type === 'email' || field.type === 'tel' || /e.?mail|phone|mobile/iu.test(text)) {
    return verificationFlow || /verif|one.?time|otp|receive.{0,30}code|send.{0,30}code/iu.test(text);
  }
  return false;
}

export function isConditionalChoice(field: FormField): boolean {
  // A multi-select question can contain words such as "treatment" in one
  // answer without that answer controlling a separate form flow.
  if (field.type === 'checkbox' && field.question) return false;
  if (field.type === 'radio') return /prescrib|diagnos|currently\s+tak|savings.?card|activat|existing.?card|need.{0,30}card|which form|different form|form type/iu
    .test(`${field.question ?? ''} ${field.label} ${field.name ?? ''}`);
  if (field.tag === 'select') return /diagnos|disease|condition|savings.?card|activat|existing.?card|which form|form type|enroll|eligib|program/iu
    .test(`${field.question ?? ''} ${field.label} ${field.name ?? ''}`);
  if (field.type === 'checkbox') return /savings.?card|activat|existing.?card|which form|form type|enroll/iu
    .test(`${field.label} ${field.name ?? ''}`);
  return false;
}

/** Request only flow decisions and values that need a real identity or code. */
export function needsHumanInput(field: FormField, verificationFlow = false): boolean {
  // Registration addresses can be checked for existing accounts even when
  // the page has no OTP flow or second email input.
  return isEmailField(field) || isVerifiedField(field, verificationFlow) || isConditionalChoice(field);
}

export function readHumanValues(fields: FormField[], input: unknown): GeneratedValue[] {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ExcelPayloadError('Provide values for the displayed fields.');
  const entries = Object.entries(input);
  if (entries.some(([, value]) => typeof value !== 'string' || value.length > 10000)) {
    throw new ExcelPayloadError('Field values must be text of at most 10000 characters.');
  }
  const values = entries.map(([fieldId, value]) => ({ fieldId, value: value as string }));
  const validation = validateGeneratedValues(fields, values);
  const emailPair = pairedEmailFields(fields);
  if (emailPair.length) {
    const primary = emailPair.find(field => !/verif|confirm|re.?enter|repeat/iu.test(`${field.label} ${field.name ?? ''}`));
    for (const confirmation of emailPair.filter(field => field !== primary)) {
      if (primary && validation.values.get(primary.id)?.trim() !== validation.values.get(confirmation.id)?.trim()) {
        validation.errors.push(`${confirmation.label}: enter the same email address as ${primary.label}`);
      }
    }
  }
  for (const field of fields.filter(field => ['radio', 'checkbox'].includes(field.type))) {
    const value = validation.values.get(field.id);
    if (value !== 'true' && value !== 'false') validation.errors.push(`${field.label}: choose an answer`);
    if (field.type === 'checkbox' && field.required && value !== 'true') validation.errors.push(`${field.label}: required selection`);
  }
  const groups = new Map<string, FormField[]>();
  for (const field of fields.filter(field => field.type === 'radio')) {
    const key = field.name ?? field.id;
    groups.set(key, [...(groups.get(key) ?? []), field]);
  }
  for (const group of groups.values()) {
    const checked = group.filter(field => validation.values.get(field.id) === 'true').length;
    if (checked !== 1) validation.errors.push(`Choose one option for ${group[0]?.name ?? 'the radio group'}.`);
  }
  if (validation.errors.length) throw new ExcelPayloadError(validation.errors.join(' '));
  return values;
}

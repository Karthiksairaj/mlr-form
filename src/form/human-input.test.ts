import { describe, expect, it } from 'vitest';
import { needsHumanInput, pairedEmailFields, readHumanValues } from './human-input.js';
import type { FormField } from '../types.js';
const field = (label: string, extra: Partial<FormField> = {}): FormField => ({ id: 'f', tag: 'input', type: 'text', label, required: true, disabled: false, readOnly: false, ...extra });
describe('guided AI inputs', () => {
  it.each(['NPI Number', 'Card activation number', 'Verification code', 'OTP', 'Member ID'])('keeps %s human supplied', label => expect(needsHumanInput(field(label))).toBe(true));
  it('generates ordinary fields but requests conditional controls', () => {
    expect(needsHumanInput(field('First name'))).toBe(false);
    expect(needsHumanInput(field('Street address'))).toBe(false);
    expect(needsHumanInput(field('Email address', { type: 'email' }))).toBe(true);
    expect(needsHumanInput(field('Email Address', { type: 'text', name: 'YourEmail' }))).toBe(true);
    expect(needsHumanInput(field('Email updates', { type: 'checkbox' }))).toBe(false);
    expect(needsHumanInput(field('Mobile phone', { type: 'tel' }))).toBe(false);
    expect(needsHumanInput(field('State', { tag: 'select' }))).toBe(false);
    expect(needsHumanInput(field('Male', { type: 'radio', name: 'gender', question: 'Gender' }))).toBe(false);
    expect(needsHumanInput(field('I agree', { type: 'checkbox' }))).toBe(false);
    expect(needsHumanInput(field('Prescription treatment', { type: 'checkbox', name: 'treatments',
      question: 'How have you been trying to manage your symptoms?', groupRequired: true }))).toBe(false);
    expect(needsHumanInput(field('Condition', { tag: 'select' }))).toBe(true);
    expect(needsHumanInput(field('Yes', { type: 'radio', name: 'prescribed', question: 'Are you currently prescribed QULIPTA?' }))).toBe(true);
    expect(needsHumanInput(field('Yes', { type: 'radio', name: 'takingMedication', question: 'Are you currently taking LINZESS?' }))).toBe(true);
    expect(needsHumanInput(field('No', { type: 'radio', name: 'route', question: 'Do you need a different form?' }))).toBe(true);
    expect(needsHumanInput(field('Yes', { type: 'radio', name: 'newsletter', question: 'Would you like a newsletter?' }))).toBe(false);
    expect(needsHumanInput(field('Private insurance', { type: 'radio', name: 'coverage', question: 'What kind of insurance do you have?' }))).toBe(false);
    expect(needsHumanInput(field('Yes', { type: 'radio', name: 'residency', question: 'Are you a resident of the United States?' }))).toBe(false);
    expect(needsHumanInput(field('Yes', { type: 'radio', name: 'medicare', question: 'Are you enrolled in Medicare or Medicaid?' }))).toBe(false);
    expect(needsHumanInput(field('No', { type: 'radio', name: 'retiree', question: 'Are you Medicare-eligible and enrolled in an employer-sponsored plan?' }))).toBe(false);
    expect(needsHumanInput(field('Marketing consent', { type: 'checkbox', name: 'marketingoptin' }))).toBe(false);
    expect(needsHumanInput(field('Email address', { type: 'email' }), true)).toBe(true);
  });
  it('preserves leading zeros and rejects fabricated field IDs, missing fields, and invalid email', () => {
    const fields = [field('NPI', { pattern: '[0-9]{10}' })];
    expect(readHumanValues(fields, { f: '0012345678' })).toEqual([{ fieldId: 'f', value: '0012345678' }]);
    expect(() => readHumanValues(fields, { unknown: 'test' })).toThrow();
    expect(() => readHumanValues(fields, {})).toThrow();
    expect(() => readHumanValues([field('Email', { type: 'email' })], { f: 'invalid' })).toThrow();
  });
  it('keeps both address fields together and rejects mismatched confirmation', () => {
    const emails = [field('Email Address', { id: 'email', type: 'email', name: 'emailTextbox' }),
      field('Verify Email Address', { id: 'verify', type: 'email', name: 'verifyEmailTextbox' })];
    expect(pairedEmailFields(emails).map(item => item.id)).toEqual(['email', 'verify']);
    expect(() => readHumanValues(emails, { email: 'one@example.test', verify: 'two@example.test' })).toThrow(/same email address/);
    expect(readHumanValues(emails, { email: 'one@example.test', verify: 'one@example.test' })).toHaveLength(2);
  });
});

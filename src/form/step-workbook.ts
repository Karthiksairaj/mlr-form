import ExcelJS from 'exceljs';
import type { FormField, GeneratedValue } from '../types.js';
import { ExcelPayloadError, loadExcelPayload } from './excel-payload.js';
import { validateGeneratedValues } from './field-validation.js';

export function editableFields(fields: FormField[]): FormField[] {
  return fields.filter(field => !field.disabled && !field.readOnly &&
    !['hidden', 'submit', 'button', 'file'].includes(field.type));
}

export async function createStepWorkbook(fields: FormField[], token: string, pageUrl: string, step: number, initialValues = new Map<string, string>()): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Payload', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [
    { header: 'Field', width: 20 }, { header: 'Value', width: 30 },
    { header: 'Label', width: 38 }, { header: 'Type', width: 16 },
    { header: 'Required', width: 12 }, { header: 'Options / format', width: 60 }
  ];
  sheet.getColumn(2).numFmt = '@';
  for (const field of editableFields(fields)) {
    const guidance = [
      field.options?.map(option => `${option.value} (${option.label})`).join('; '),
      ['radio', 'checkbox'].includes(field.type) ? `true or false${field.name ? `; group: ${field.name}` : ''}` : undefined,
      field.type === 'date' ? 'YYYY-MM-DD' : undefined,
      field.pattern ? `Pattern: ${field.pattern}` : undefined,
      field.minLength !== undefined ? `Min length: ${field.minLength}` : undefined,
      field.maxLength !== undefined ? `Max length: ${field.maxLength}` : undefined,
      field.min ? `Min: ${field.min}` : undefined, field.max ? `Max: ${field.max}` : undefined
    ].filter(Boolean).join('\n');
    const row = sheet.addRow([field.id, initialValues.get(field.id) ?? '', field.label, field.type, field.required ? 'Yes' : 'No', guidance]);
    row.alignment = { vertical: 'top', wrapText: true };
    row.height = Math.min(150, Math.max(32, guidance.split('\n').length * 16, Math.ceil(guidance.length / 60) * 16));
    row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FAFC' } };
  }
  sheet.getRow(1).height = 28;
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B7285' } };
  const guide = workbook.addWorksheet('Instructions');
  guide.getColumn(1).width = 100;
  guide.addRows([
    [`Form data - step ${step}`], [pageUrl],
    ['Fill the blue Value cells on Payload. Keep Field identifiers and sheet names unchanged.'],
    ['Values are formatted as Text. Keep identifiers as text to preserve leading zeros.'],
    ['For radio choices, enter true for one option and false (or blank) for the others.'],
    ['Required values must be filled. Optional blanks remain empty unless you choose AI for blank values when uploading.'],
    ['Upload this workbook in the runner. Fields revealed on the same page are requested separately; existing answers are retained.'],
    ['If the page rejects a value, correct your workbook and upload it again while the same step is open.']
  ]);
  guide.eachRow(row => { row.alignment = { wrapText: true }; row.height = 32; });
  const session = workbook.addWorksheet('_Session', { state: 'veryHidden' });
  session.getCell('A1').value = token;
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function readStepWorkbook(input: unknown, fields: FormField[], token: string, useAI: boolean): Promise<GeneratedValue[]> {
  const workbook = await loadExcelPayload(input);
  if (workbook.getWorksheet('_Session')?.getCell('A1').value !== token) {
    throw new ExcelPayloadError('This workbook belongs to another step. Download the Excel for the current step.');
  }
  const sheet = workbook.getWorksheet('Payload');
  if (!sheet || sheet.getCell('A1').value !== 'Field' || sheet.getCell('B1').value !== 'Value' || sheet.rowCount > 501) {
    throw new ExcelPayloadError('Keep the Payload sheet and its Field and Value headers unchanged (maximum 500 fields).');
  }
  const expected = editableFields(fields);
  const byId = new Map(expected.map(field => [field.id, field]));
  const seen = new Set<string>();
  const supplied: GeneratedValue[] = [];
  for (let number = 2; number <= sheet.rowCount; number += 1) {
    const key = sheet.getCell(number, 1).value;
    const value = sheet.getCell(number, 2).value;
    if (key == null && value == null) continue;
    if (typeof key !== 'string' || !byId.has(key) || seen.has(key)) {
      throw new ExcelPayloadError(`Row ${number}: unknown or duplicate Field. Keep the downloaded identifiers unchanged.`);
    }
    seen.add(key);
    const field = byId.get(key)!;
    if (value != null && typeof value !== 'string') {
      throw new ExcelPayloadError(`Row ${number} (${field.label}): enter Value as text, not a number or formula.`);
    }
    if (typeof value === 'string' && value.length > 10000) throw new ExcelPayloadError(`Row ${number}: Value is too long.`);
    if (useAI && (value == null || value === '')) continue;
    supplied.push({ fieldId: key, value: value || (['radio', 'checkbox'].includes(field.type) ? 'false' : '') });
  }
  if (seen.size !== expected.length) throw new ExcelPayloadError('Some field rows were removed. Use the complete workbook for this step.');
  // A selected radio also fixes its blank siblings, preventing AI from selecting a second option.
  for (const selected of [...supplied]) {
    const field = byId.get(selected.fieldId)!;
    if (field.type !== 'radio' || selected.value !== 'true' || !field.name) continue;
    for (const sibling of expected.filter(candidate => candidate.type === 'radio' && candidate.name === field.name)) {
      if (!supplied.some(item => item.fieldId === sibling.id)) supplied.push({ fieldId: sibling.id, value: 'false' });
    }
  }
  const validationFields = useAI ? expected.filter(field => supplied.some(item => item.fieldId === field.id)) : expected;
  const validation = validateGeneratedValues(validationFields, supplied);
  if (validation.errors.length) {
    const errors = validation.errors.map(error => error.replace(/^([^:]+):/u, (match, id: string) => byId.has(id) ? `${byId.get(id)!.label}:` : match));
    throw new ExcelPayloadError(errors.join('; '));
  }
  return supplied;
}

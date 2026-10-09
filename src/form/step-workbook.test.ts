import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { FormField } from '../types.js';
import { createStepWorkbook, readStepWorkbook } from './step-workbook.js';

const fields: FormField[] = [{ id: 'mlr-field-0', tag: 'input', type: 'text', label: 'NPI Number', name: 'npi',
  required: true, disabled: false, readOnly: false, pattern: '[0-9]{10}' }];
async function workbookInput(edit: (book: ExcelJS.Workbook) => void = () => {}) {
  const buffer = await createStepWorkbook(fields, 'token-one', 'https://example.test/form', 1);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(Uint8Array.from(buffer).buffer);
  edit(book);
  return { filename: 'step.xlsx', base64: Buffer.from(await book.xlsx.writeBuffer()).toString('base64') };
}

describe('page-specific Excel workbooks', () => {
  it('includes labels and constraints with editable text cells', async () => {
    await workbookInput(book => {
      expect(book.getWorksheet('Payload')!.getCell('C2').value).toBe('NPI Number');
      expect(book.getWorksheet('Payload')!.getCell('B2').numFmt).toBe('@');
      expect(book.getWorksheet('Payload')!.getCell('F2').value).toContain('[0-9]{10}');
      expect(book.getWorksheet('_Session')!.state).toBe('veryHidden');
    });
  });
  it('preserves entered values exactly', async () => {
    const file = await workbookInput(book => { book.getWorksheet('Payload')!.getCell('B2').value = '0012345678'; });
    expect(await readStepWorkbook(file, fields, 'token-one', false)).toEqual([{ fieldId: 'mlr-field-0', value: '0012345678' }]);
  });
  it('prefills a correction workbook with retained text values that can be edited', async () => {
    const buffer = await createStepWorkbook(fields, 'correction-token', 'https://example.test/form', 1,
      new Map([['mlr-field-0', '0012345678']]));
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(Uint8Array.from(buffer).buffer);
    const cell = book.getWorksheet('Payload')!.getCell('B2');
    expect(cell.value).toBe('0012345678');
    expect(cell.numFmt).toBe('@');
    cell.value = '0098765432';
    const file = { filename: 'corrected.xlsx', base64: Buffer.from(await book.xlsx.writeBuffer()).toString('base64') };
    expect(await readStepWorkbook(file, fields, 'correction-token', false))
      .toEqual([{ fieldId: 'mlr-field-0', value: '0098765432' }]);
  });
  it('requires manual values unless AI is explicitly selected', async () => {
    const file = await workbookInput();
    await expect(readStepWorkbook(file, fields, 'token-one', false)).rejects.toThrow('NPI Number: required');
    expect(await readStepWorkbook(file, fields, 'token-one', true)).toEqual([]);
  });
  it('rejects another step workbook', async () => {
    await expect(readStepWorkbook(await workbookInput(), fields, 'token-two', false)).rejects.toThrow('another step');
  });
  it('rejects numeric identifiers and removed rows', async () => {
    const numeric = await workbookInput(book => { book.getWorksheet('Payload')!.getCell('B2').value = 1234567890; });
    await expect(readStepWorkbook(numeric, fields, 'token-one', false)).rejects.toThrow('as text');
    const removed = await workbookInput(book => { book.getWorksheet('Payload')!.spliceRows(2, 1); });
    await expect(readStepWorkbook(removed, fields, 'token-one', true)).rejects.toThrow('rows were removed');
  });
});

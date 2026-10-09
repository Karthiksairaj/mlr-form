import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { parseExcelPayload } from './excel-payload.js';

export async function excelInput(rows: ExcelJS.CellValue[][]) {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('Payload').addRows(rows);
  return { filename: 'payload.xlsx', base64: Buffer.from(await workbook.xlsx.writeBuffer()).toString('base64') };
}

describe('Excel payload import', () => {
  it('preserves text identifiers and skips blank values', async () => {
    expect(await parseExcelPayload(await excelInput([
      ['Field', 'Value'], ['npi', '0012345678'], ['cardActivationNumber', '000000012345678901'], ['Email', null]
    ]))).toEqual({ npi: '0012345678', cardActivationNumber: '000000012345678901' });
  });

  it.each([
    { rows: [['Name', 'Data']], message: 'Field in A1' },
    { rows: [['Field', 'Value'], ['npi', 1234567890]], message: 'store Value as text' },
    { rows: [['Field', 'Value'], ['npi', { formula: '1+1', result: 2 }]], message: 'store Value as text' },
    { rows: [['Field', 'Value'], ['NPI', '123'], [' npi ', '456']], message: 'duplicate Field' },
    { rows: [['Field', 'Value'], [null, '123']], message: 'Field must be' }
  ])('rejects invalid sheet content: $message', async ({ rows, message }) => {
    await expect(parseExcelPayload(await excelInput(rows))).rejects.toThrow(message);
  });

  it('rejects corrupt files and unsupported extensions', async () => {
    await expect(parseExcelPayload({ filename: 'data.xls', base64: 'YWJj' })).rejects.toThrow('.xlsx');
    await expect(parseExcelPayload({ filename: 'data.xlsx', base64: 'YWJj' })).rejects.toThrow('Unable to read');
  });
});

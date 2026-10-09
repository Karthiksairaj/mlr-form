import ExcelJS from 'exceljs';
import { normalizePayloadKey } from './payload.js';

export class ExcelPayloadError extends Error {}

export async function loadExcelPayload(input: unknown): Promise<ExcelJS.Workbook> {
  if (!input || typeof input !== 'object') throw new ExcelPayloadError('Choose an Excel .xlsx payload file.');
  const { filename, base64 } = input as { filename?: unknown; base64?: unknown };
  if (typeof filename !== 'string' || !filename.toLowerCase().endsWith('.xlsx')) {
    throw new ExcelPayloadError('The payload must be an Excel .xlsx file.');
  }
  if (typeof base64 !== 'string' || !base64.length || base64.length > 1_400_000 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(base64)) {
    throw new ExcelPayloadError('The Excel payload must be a valid file no larger than 1 MB.');
  }
  const data = Buffer.from(base64, 'base64');
  if (data.length > 1024 * 1024) throw new ExcelPayloadError('The Excel payload must be no larger than 1 MB.');
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(Uint8Array.from(data).buffer);
  } catch {
    throw new ExcelPayloadError('Unable to read the Excel file. Save it as an unencrypted .xlsx workbook.');
  }
  return workbook;
}

export async function parseExcelPayload(input: unknown): Promise<Record<string, string>> {
  const workbook = await loadExcelPayload(input);
  const sheet = workbook.getWorksheet('Payload') ?? workbook.worksheets[0];
  if (!sheet || sheet.getCell('A1').text.trim().toLowerCase() !== 'field' ||
    sheet.getCell('B1').text.trim().toLowerCase() !== 'value') {
    throw new ExcelPayloadError('The payload sheet must start with Field in A1 and Value in B1.');
  }
  if (sheet.rowCount > 501 || sheet.columnCount > 2) {
    throw new ExcelPayloadError('Use only Field and Value columns, with at most 500 data rows.');
  }
  const payload: Record<string, string> = Object.create(null);
  const seen = new Set<string>();
  for (let row = 2; row <= sheet.rowCount; row += 1) {
    const key = sheet.getCell(row, 1).value;
    const value = sheet.getCell(row, 2).value;
    if (key == null && value == null) continue;
    if (typeof key !== 'string' || !key.trim() || key.length > 200) {
      throw new ExcelPayloadError(`Row ${row}: Field must be a name or label stored as text (up to 200 characters).`);
    }
    const normalized = normalizePayloadKey(key);
    if (seen.has(normalized)) throw new ExcelPayloadError(`Row ${row}: duplicate Field. Keep one row per field.`);
    seen.add(normalized);
    if (value == null || value === '') continue;
    if (typeof value !== 'string' || value.length > 10000) {
      throw new ExcelPayloadError(`Row ${row}: store Value as text (up to 10,000 characters). Format the cell as Text and re-enter the value to preserve identifiers and leading zeros.`);
    }
    payload[key.trim()] = value;
  }
  return payload;
}

import type { ExcelPayload } from './types';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export function authHeaders(token: string): Record<string, string> {
  return token.trim() ? { authorization: `Bearer ${token.trim()}` } : {};
}

export async function responseError(response: Response): Promise<ApiError> {
  const body = await response.json().catch(() => null) as { message?: string; details?: Array<{ message: string; path: string[] }> } | null;
  const details = body?.details?.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(' ');
  return new ApiError(details || body?.message || `Request failed (${response.status}). Check the backend connection and try again.`, response.status);
}

export async function api<T>(url: string, token: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { 'content-type': 'application/json', ...authHeaders(token), ...options.headers }
  });
  if (!response.ok) throw await responseError(response);
  return response.json() as Promise<T>;
}

export function errorMessage(error: unknown): string {
  if (error instanceof TypeError) return 'Cannot reach the backend. Check that the API server is running, then retry.';
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export async function excelPayload(file: File | undefined): Promise<ExcelPayload | undefined> {
  if (!file) return undefined;
  if (!file.name.toLowerCase().endsWith('.xlsx')) throw new Error('Choose an Excel .xlsx workbook.');
  if (file.size > 1024 * 1024) throw new Error('The Excel workbook must be no larger than 1 MB.');
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('Unable to read the workbook. Select the file again.'));
    reader.readAsDataURL(file);
  });
  return { filename: file.name, base64 };
}

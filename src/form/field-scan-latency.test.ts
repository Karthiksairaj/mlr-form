import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Frame, Page } from 'playwright';
import type { FormField } from '../types.js';
import { extractVisibleFieldCandidates, extractVisibleFields } from './field-extractor.js';

function frame(url: string, result: () => Promise<FormField[]>) {
  const evaluateAll = vi.fn(result);
  return { value: { url: () => url, isDetached: () => false,
    locator: () => ({ evaluateAll }) } as unknown as Frame, evaluateAll };
}
describe('field discovery with slow frames', () => {
  afterEach(() => vi.useRealTimers());
  it('keeps an active embedded form instead of alternating back to a faster outer chooser', async () => {
    vi.useFakeTimers();
    const outer = [{ id: 'choice', tag: 'select', type: 'select' }] as FormField[];
    const inner = [{ id: 'email', tag: 'input', type: 'email', frameUrl: 'https://example.test/form' },
      { id: 'name', tag: 'input', type: 'text', frameUrl: 'https://example.test/form' }] as FormField[];
    const main = frame('https://example.test/', async () => outer);
    const embedded = frame('https://example.test/form', () => new Promise(resolve => setTimeout(() => resolve(inner), 30)));
    const page = { mainFrame: () => main.value, frames: () => [main.value, embedded.value] } as unknown as Page;
    expect(await extractVisibleFields(page)).toEqual(outer);
    await vi.advanceTimersByTimeAsync(50);
    expect(await extractVisibleFields(page)).toEqual(inner);
    const next = extractVisibleFields(page);
    await vi.advanceTimersByTimeAsync(30);
    expect(await next).toEqual(inner);
  });
  it('waits for a pending form scan instead of reporting an empty form', async () => {
    vi.useFakeTimers();
    const fields = [{ id: 'condition', tag: 'select', type: 'select' }] as FormField[];
    const main = frame('https://example.test/', () => new Promise(resolve => setTimeout(() => resolve(fields), 2500)));
    const page = { mainFrame: () => main.value, frames: () => [main.value] } as unknown as Page;
    let settled = false;
    const result = extractVisibleFields(page).then(value => { settled = true; return value; });
    await vi.advanceTimersByTimeAsync(1500);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await result).toEqual(fields);
    expect(main.evaluateAll).toHaveBeenCalledTimes(1);
  });
  it('returns ready fields without piling up scans on a stalled frame, and includes it when ready', async () => {
    vi.useFakeTimers();
    const mainFields = [{ id: 'condition', tag: 'select' }] as FormField[];
    const embeddedFields = [{ id: 'email', tag: 'input' }] as FormField[];
    let resolveEmbedded!: (fields: FormField[]) => void;
    const main = frame('https://example.test/', async () => mainFields);
    const embedded = frame('https://example.test/form', () => new Promise(resolve => { resolveEmbedded = resolve; }));
    const page = { mainFrame: () => main.value, frames: () => [main.value, embedded.value] } as unknown as Page;
    const first = extractVisibleFieldCandidates(page);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await first).toEqual([mainFields]);
    const second = extractVisibleFieldCandidates(page);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await second).toEqual([mainFields]);
    expect(embedded.evaluateAll).toHaveBeenCalledTimes(1);
    resolveEmbedded(embeddedFields);
    await vi.advanceTimersByTimeAsync(0);
    expect(await extractVisibleFieldCandidates(page)).toEqual([mainFields, embeddedFields]);
  });
});

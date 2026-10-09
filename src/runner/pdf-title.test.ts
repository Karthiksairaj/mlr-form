import { describe, expect, it } from 'vitest';
import { pdfScreenshotTitle } from './form-runner.js';

describe('pdfScreenshotTitle', () => {
  it('uses the simple MLR URL and form-view title pattern', () => {
    const url = 'https://www.linzess.com/savings-card';
    expect(pdfScreenshotTitle(url, 'form-ready'))
      .toBe(`${url} - Form Initial View`);
    expect(pdfScreenshotTitle(url, 'step-2-filled'))
      .toBe(`${url} - Form Filled View`);
  });
});

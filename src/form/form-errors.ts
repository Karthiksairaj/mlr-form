import type { Page } from 'playwright';

/** Read the site's visible validation feedback without guessing its cause. */
export async function readFormErrors(page: Page): Promise<string[]> {
  const messages: string[] = [];
  for (const frame of page.frames()) {
    if (frame.isDetached()) continue;
    const found = await frame.evaluate(() => {
      const visible = (element: Element) => {
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' ||
          element.closest('[hidden], [aria-hidden="true"]')) return false;
        if (element.getClientRects().length > 0) return true;
        const range = document.createRange();
        range.selectNodeContents(element);
        return [...range.getClientRects()].some(rect => rect.width > 0 && rect.height > 0);
      };
      const normalize = (text: string) => text.replace(/\s+/gu, ' ').trim().slice(0, 500);
      const results: string[] = [];
      const candidates = document.querySelectorAll([
        '[role="alert"]', '[aria-live="assertive"]', '.error-message',
        '[class*="errormessage" i]', '[class*="error-message" i]',
        '[class*="errorMessage"]', '[id*="error-message" i]'
      ].join(', '));
      for (const element of candidates) {
        if (visible(element)) results.push(normalize((element as HTMLElement).innerText ?? ''));
      }
      // Some forms show a plain paragraph for a service error, without ARIA
      // or an error-specific class. Only capture the matching leaf message.
      const failure = /(?:request|submission) (?:could not|cannot|can not|was not|couldn't) be processed|unable to (?:process|submit)|please try again later|e.?mail.{0,80}already.{0,30}(?:in use|registered|exists)/iu;
      for (const element of document.querySelectorAll('p, span, div')) {
        if (!visible(element)) continue;
        const text = (element as HTMLElement).innerText || element.textContent || '';
        if (text.length <= 500 && failure.test(text) &&
          ![...element.children].some(child => visible(child) && failure.test((child as HTMLElement).innerText ?? ''))) {
          results.push(normalize(text));
        }
      }
      for (const control of document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input:invalid, select:invalid, textarea:invalid')) {
        if (!visible(control) || !control.validationMessage) continue;
        const label = control.labels?.[0]?.textContent?.trim() || control.getAttribute('aria-label') || control.name;
        results.push(normalize(`${label ? `${label}: ` : ''}${control.validationMessage}`));
      }
      return [...new Set(results.filter(Boolean))].slice(0, 5);
    }).catch(() => [] as string[]);
    messages.push(...found);
  }
  return [...new Set(messages)].slice(0, 5);
}

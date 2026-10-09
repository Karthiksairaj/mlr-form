import type { Locator, Page } from 'playwright';
import type { ExpectedOutcome } from '../types.js';

function frameUrl(frame: ReturnType<Page['mainFrame']>): string | undefined {
  try {
    return frame.isDetached() ? undefined : frame.url();
  } catch {
    return undefined;
  }
}

async function firstVisibleText(locator: Locator): Promise<string | undefined> {
  // AEM commonly replaces its form iframe immediately after submit. Locators
  // created from the previous frame can become detached during inspection.
  // Inspect the matched elements in one browser evaluation: Playwright's
  // regex text locators can throw when composed with nth(index).
  return locator.evaluateAll(elements => {
    const visible = elements.find(element => {
      const style = getComputedStyle(element);
      return element.getClientRects().length > 0 && style.visibility !== 'hidden';
    });
    if (!visible) return undefined;
    return ((visible as HTMLElement).innerText ?? visible.textContent ?? '').slice(0, 300);
  }).catch(() => undefined);
}

export async function validateOutcome(
  page: Page,
  expected?: ExpectedOutcome,
  previousUrl?: string
): Promise<{ matched: boolean; type?: 'url' | 'redirect' | 'text' | 'selector' | 'default-text'; value?: string }> {
  if (expected?.urlContains) {
    const matchingUrl = page.frames()
      .map(frameUrl)
      .find(url => url?.includes(expected.urlContains!));
    if (matchingUrl) return { matched: true, type: 'url', value: matchingUrl };
  }
  if (expected?.selector) {
    for (const frame of page.frames()) {
      if (frame.isDetached()) continue;
      const visibleText = await firstVisibleText(frame.locator(expected.selector)).catch(() => undefined);
      if (visibleText !== undefined) {
        return { matched: true, type: 'selector', value: expected.selector };
      }
    }
  }
  if (expected?.textContains) {
    for (const frame of page.frames()) {
      if (frame.isDetached()) continue;
      const visibleText = await firstVisibleText(frame.getByText(expected.textContains, { exact: false }))
        .catch(() => undefined);
      if (visibleText !== undefined) {
        return { matched: true, type: 'text', value: expected.textContains };
      }
    }
  }
  if (!expected) {
    for (const frame of page.frames()) {
      if (frame.isDetached()) continue;
      const defaultConfirmation = frame.locator([
        '[role="status"]',
        '[role="alert"]',
        '[class*="thank-you" i]',
        '[class*="thankyou" i]',
        '[class*="confirmation" i]',
        '[class*="success" i]'
      ].join(', ')).filter({
        hasText: /thank you|received|submitted|registration complete|confirmation number|success|congratulations|signed up/iu
      });
      const visibleText = await firstVisibleText(defaultConfirmation).catch(() => undefined) ??
        await firstVisibleText(frame.getByText(
          /thank you|submission (?:was )?received|successfully submitted|registration complete|confirmation number|congratulations.{0,100}signed up|you (?:are|'re) signed up/iu
        )).catch(() => undefined);
      if (visibleText !== undefined) {
        return { matched: true, type: 'default-text', value: visibleText };
      }
    }
  }
  if (previousUrl && page.url() !== previousUrl) {
    return { matched: true, type: 'redirect', value: page.url() };
  }
  return { matched: false };
}

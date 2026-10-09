import type { Frame, Locator, Page } from 'playwright';
import type { FormField } from '../types.js';

export type FormAction = {
  id: string;
  label: string;
  kind: 'next' | 'submit';
  locator: Locator;
};

function formFrame(page: Page, fields: FormField[]): Frame | undefined {
  const frameUrl = fields.find(field => field.frameUrl)?.frameUrl;
  if (!frameUrl) return page.mainFrame();
  const frames = page.frames().filter(frame => !frame.isDetached());
  return frames.find(frame => frame.url() === frameUrl) ?? frames.find(frame => {
    try {
      const expected = new URL(frameUrl);
      const actual = new URL(frame.url());
      return actual.origin === expected.origin && actual.pathname === expected.pathname;
    } catch {
      return false;
    }
  });
}

/** Discover every currently available route through the active form. */
export async function discoverFormActions(page: Page, fields: FormField[]): Promise<FormAction[]> {
  const frame = formFrame(page, fields);
  if (!frame) return [];
  const actions = await frame.locator(
    'button, input[type="submit"], input[type="button"], input[type="image"], a[href], [role="button"], [role="link"]'
  ).evaluateAll((elements, fieldIds) => {
    const rootSelector = 'form, [role="form"], .cmp-adaptiveform-container, [class*="adaptiveform-container"], [class*="form-container"]';
    let roots = [...document.querySelectorAll('[data-mlr-active-form="true"]')];
    if (roots.length === 0) {
      roots = [...new Set(fieldIds.flatMap(id => {
        const control = document.querySelector(`[data-mlr-field-id="${CSS.escape(id)}"]`);
        const root = control?.closest(rootSelector);
        return root ? [root] : [];
      }))];
    }
    if (roots.length === 0) roots = [document.body];

    const nextLabel = /\b(?:next|continue|proceed|verify|look\s*up|log\s*in|sign\s*in|start|begin)\b/iu;
    const submitLabel = /\b(?:submit|register|send|finish|complete|results|save|apply|redeem|request)\b|\b(?:get(?:\s+a)?\s+new|activate(?:\s+(?:my|your|an?|existing))?)(?:\s+(?:savings|copay))?\s+card\b/iu;
    const excludedLabel = /^(?:(?:go\s+)?back|previous|cancel|reset|clear|close|exit|log\s*out|sign\s*out)\b/iu;
    // Alternate card routes often sit beside, rather than inside, the form.
    // Requiring a specific route label avoids unrelated calls to action in
    // the rest of the document (for example "Start learning" or "Register").
    const alternateLabel = /^(?:(?:activate(?:\s+(?:my|your|an?|existing))?|get(?:\s+a)?\s+new)(?:\s+(?:savings|copay))?\s+card)(?:\s+(?:now|here))?[.!\s]*$/iu;
    const candidateElements = new Set(elements);
    const assignedIds = new Set<string>();
    const allIds = new Set([...document.querySelectorAll('[data-mlr-action-id]')]
      .map(element => element.getAttribute('data-mlr-action-id')!));
    let counter = 0;
    const result: Array<{ id: string; label: string; kind: 'next' | 'submit' }> = [];

    for (const element of elements) {
      if (element.closest('header, nav, footer, [role="banner"], [role="navigation"], [role="contentinfo"], [inert], [aria-disabled="true"]')) continue;
      if (element.matches(':disabled') || element.getAttribute('type')?.toLowerCase() === 'reset' || element.hasAttribute('download')) continue;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || rect.width <= 0 || rect.height <= 0) continue;
      // A role on a child span must not turn one button into two routes.
      let parent = element.parentElement;
      let nested = false;
      while (parent) {
        if (candidateElements.has(parent)) { nested = true; break; }
        parent = parent.parentElement;
      }
      if (nested) continue;

      const labelledBy = element.getAttribute('aria-labelledby')?.split(/\s+/u)
        .map(id => document.getElementById(id)?.textContent ?? '').join(' ');
      const value = element instanceof HTMLInputElement ? element.value : '';
      const label = ([labelledBy, element.getAttribute('aria-label'), value, element.textContent, element.getAttribute('alt'), element.getAttribute('title')]
        .map(text => (text ?? '').replace(/\s+/gu, ' ').trim()).find(Boolean) ?? '').slice(0, 200);
      if (excludedLabel.test(label)) continue;

      const ownerForm = element instanceof HTMLButtonElement || element instanceof HTMLInputElement ? element.form : null;
      const inActiveRoot = roots.some(root => root.contains(element) || Boolean(ownerForm && (root === ownerForm || root.contains(ownerForm))));
      const otherForm = element.closest(rootSelector);
      if (!inActiveRoot && (!alternateLabel.test(label) || (otherForm && !roots.some(root => root.contains(otherForm) || otherForm.contains(root))))) continue;

      const nativeSubmit = (element instanceof HTMLButtonElement && element.type === 'submit') ||
        (element instanceof HTMLInputElement && ['submit', 'image'].includes(element.type));
      const adaptiveSubmit = element.matches('button.cmp-adaptiveform-button__widget.submit');
      // AEM type="button" controls can submit through custom handlers even
      // without the .submit class. Keep card actions under submission control.
      const kind = nextLabel.test(label) ? 'next' : submitLabel.test(label) || nativeSubmit || adaptiveSubmit ? 'submit' : undefined;
      if (!kind) continue;

      let id: string | undefined = element.getAttribute('data-mlr-action-id') ?? undefined;
      if (!id || assignedIds.has(id)) {
        const authoredId = element.id ? `id:${element.id}` : undefined;
        id = authoredId && !allIds.has(authoredId) && !assignedIds.has(authoredId) ? authoredId : undefined;
        while (!id) {
          const generated = `mlr-action-${counter++}`;
          if (!allIds.has(generated) && !assignedIds.has(generated)) id = generated;
        }
        element.setAttribute('data-mlr-action-id', id);
        allIds.add(id);
      }
      assignedIds.add(id);
      result.push({ id, label: label || 'Submit', kind });
    }
    return result;
  }, fields.map(field => field.id));

  return actions.map(action => ({
    ...action,
    locator: frame.locator(`[data-mlr-action-id=${JSON.stringify(action.id)}]`)
  }));
}

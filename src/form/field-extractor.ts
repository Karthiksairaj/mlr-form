import type { Frame, Page } from 'playwright';
import type { FormField } from '../types.js';
import { terminalColor } from '../terminal-colors.js';

const transientFrameError = /Execution context was destroyed|frame was detached|Target page, context or browser has been closed|Cannot find context with specified id/iu;
const trackingFrameUrl = /(?:^|\.)adsrvr\.org|(?:^|\.)doubleclick\.net|(?:^|\.)adnxs\.com|(?:^|\.)googlesyndication\.com|(?:^|\.)googleadservices\.com/iu;

function isTrackingFrame(frame: Frame): boolean {
  try {
    return trackingFrameUrl.test(new URL(frame.url()).hostname);
  } catch {
    return false;
  }
}

function shouldInspectFrame(page: Page, frame: Frame): boolean {
  try {
    if (frame.isDetached()) return false;
    if (frame === page.mainFrame()) return true;
    if (isTrackingFrame(frame)) return false;
    if (frame.url() !== 'about:blank') return true;

    // Blank children created by a same-site form runtime can become useful,
    // while blank descendants of ad frames never contain the active form.
    let parent = frame.parentFrame();
    while (parent) {
      if (parent.isDetached()) return false;
      if (isTrackingFrame(parent)) return false;
      if (parent === page.mainFrame()) return true;
      parent = parent.parentFrame();
    }
  } catch {
    // Redirects can detach a frame between page.frames() and this filter.
    return false;
  }
  return false;
}

function safeFrameUrl(frame: Frame): string {
  try {
    return frame.url();
  } catch {
    return '<detached>';
  }
}

async function extractFrameWithRetry(page: Page, frame: Frame): Promise<FormField[]> {
  const maximumAttempts = 3;
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    if (frame.isDetached()) return [];
    try {
      return await extractVisibleFieldsInFrame(
        frame,
        frame === page.mainFrame() ? undefined : frame.url()
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!transientFrameError.test(message)) {
        console.warn(terminalColor('[mlr-form] field extraction skipped a frame', 'yellow'), {
          frameUrl: safeFrameUrl(frame),
          message
        });
        return [];
      }
      if (attempt < maximumAttempts) {
        await page.waitForTimeout(100 * attempt);
        continue;
      }
      // A navigation can invalidate all contexts for a few hundred
      // milliseconds. The outer stability poll will call extraction again.
      if (process.env.MLR_FORM_DEBUG_TRANSIENT_FRAMES === 'true') {
        console.debug(terminalColor('[mlr-form] field extraction deferred during frame navigation', 'dim'), {
          frameUrl: safeFrameUrl(frame),
          attempts: maximumAttempts
        });
      }
      return [];
    }
  }
  return [];
}

export async function extractVisibleFields(page: Page): Promise<FormField[]> {
  let candidates = await extractVisibleFieldCandidates(page);
  const deadline = Date.now() + 15_000;
  // An in-flight scan is not an empty form. Consume its eventual result rather
  // than sending a transient empty array into workflow/confirmation logic.
  while (!candidates.length && hasPendingFieldScans(page)) {
    if (Date.now() >= deadline) throw new FieldScanPendingError();
    candidates = await extractVisibleFieldCandidates(page);
  }

  const score = (fields: FormField[]) => fields.length * 100 + fields.reduce((total, field) =>
    total + (field.tag === 'select' || ['checkbox', 'radio'].includes(field.type) ? 10 : 0), 0);
  const selected = candidates.sort((left, right) => score(right) - score(left))[0] ?? [];
  if (selected.length) {
    const frame = selected[0]?.frameUrl
      ? page.frames().find(frame => frame.url() === selected[0]?.frameUrl) : page.mainFrame();
    if (frame) activeFrames.set(page, frame);
  }
  return selected;
}

/** Return each relevant frame's form fields without discarding lower-scored frames. */
type FrameScan = { promise: Promise<void>; fields?: FormField[] };
const pendingScans = new WeakMap<Frame, FrameScan>();
export class FieldScanPendingError extends Error {
  constructor() {
    super('Form field inspection is still pending; the page has not been classified as having no fields.');
    this.name = 'FieldScanPendingError';
  }
}
function hasPendingFieldScans(page: Page): boolean {
  return page.frames().some(frame => !frame.isDetached() && pendingScans.get(frame)?.fields === undefined && pendingScans.has(frame));
}

export async function extractVisibleFieldCandidates(page: Page): Promise<FormField[][]> {
  const frames = page.frames().filter(frame => shouldInspectFrame(page, frame));
  // Start the previously active form frame first. Keep other frames eligible
  // so a condition that creates a new embedded form is still discoverable.
  frames.sort((a, b) => Number(b === activeFrames.get(page)) - Number(a === activeFrames.get(page)));
  const scans = frames.map(frame => {
    let scan = pendingScans.get(frame);
    if (!scan) {
      const entry: FrameScan = { promise: Promise.resolve() };
      entry.promise = extractFrameWithRetry(page, frame).then(fields => {
        entry.fields = fields;
      }, () => { entry.fields = []; });
      pendingScans.set(frame, entry);
      scan = entry;
    }
    return { frame, scan };
  });
  // One stalled frame must not hold up fields already found elsewhere. Keep
  // its in-flight scan for the next poll instead of issuing overlapping DOM
  // mutations or permanently excluding a slowly loading form iframe.
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.race([
        Promise.all(scans.map(({ scan }) => scan.promise)),
        ...scans.filter(({ frame }) => !activeFrames.has(page) || frame === activeFrames.get(page))
          .map(({ scan }) => scan.promise.then(() => scan.fields?.length
          ? undefined : new Promise<void>(() => {})))
      ]),
      new Promise<void>(resolve => { timer = setTimeout(resolve, 1_000); })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
  return scans.flatMap(({ frame, scan }) => {
    if (scan.fields === undefined) return [];
    if (pendingScans.get(frame) === scan) pendingScans.delete(frame);
    return !frame.isDetached() && scan.fields.length ? [scan.fields] : [];
  });
}
const activeFrames = new WeakMap<Page, Frame>();

/** Detect form presence independently from whether step execution succeeds. */
export async function detectFormPresence(page: Page): Promise<boolean> {
  const results = await Promise.all(page.frames().map(async frame => {
    try {
      return await frame.locator('body').evaluate(body => {
        const visibleControls = [...body.querySelectorAll('input:not([type="hidden"]), select, textarea')]
          .filter(element => {
            if (element.closest('header, nav, [role="banner"], [role="navigation"]')) return false;
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
          });
        if (visibleControls.length === 0) return false;
        if (visibleControls.some(control => control.closest('form, [role="form"], .cmp-adaptiveform-container'))) {
          return true;
        }
        // Conditional AEM experiences may begin with only a select/radio/
        // checkbox and render the main form several seconds later.
        return visibleControls.some(control => {
          const input = control as HTMLInputElement;
          return control.tagName === 'SELECT' || ['checkbox', 'radio'].includes(input.type);
        });
      });
    } catch {
      return false;
    }
  }));
  return results.some(Boolean);
}

async function extractVisibleFieldsInFrame(frame: Frame, frameUrl?: string): Promise<FormField[]> {
  return frame.locator('input, select, textarea').evaluateAll((elements, sourceFrameUrl) => {
    // Large conditional forms contain labels for every hidden branch. Index
    // them once instead of searching the entire document for each control.
    const labelsById = new Map<string, Element>();
    document.querySelectorAll('label[for]').forEach(label => {
      const id = label.getAttribute('for')!;
      if (!labelsById.has(id)) labelsById.set(id, label);
    });
    const hiddenBranches = new Map<Element, boolean>();
    const visibleControls = elements.filter(element => {
      const control = element as HTMLInputElement;
      // Global site controls such as QULIPTA's MIGRAINE MODE header switch
      // are not form fields and must never become workflow branches.
      if (control.closest('header, nav, [role="banner"], [role="navigation"]')) return false;
      if (control.type === 'hidden') return false;
      // Reject whole hidden branches before reading individual control/label
      // geometry. Recheck styles every pass, so newly revealed branches work.
      const ancestors: Element[] = [];
      let ancestor = control.parentElement;
      while (ancestor && !hiddenBranches.has(ancestor)) {
        ancestors.push(ancestor);
        ancestor = ancestor.parentElement;
      }
      let hidden = ancestor ? hiddenBranches.get(ancestor)! : false;
      for (let index = ancestors.length - 1; index >= 0; index -= 1) {
        const parent = ancestors[index]!;
        hidden = hidden || getComputedStyle(parent).display === 'none';
        hiddenBranches.set(parent, hidden);
      }
      if (hidden) return false;
      const controlStyle = window.getComputedStyle(control);
      const controlRect = control.getBoundingClientRect();
      if (
        controlStyle.display !== 'none' &&
        controlStyle.visibility !== 'hidden' &&
        controlRect.width > 0 &&
        controlRect.height > 0
      ) return true;
      if (!['checkbox', 'radio'].includes(control.type)) return false;

      // Adobe Adaptive Forms visually hides native checkbox/radio inputs and
      // makes the wrapping label the interactive, visible control.
      const explicitLabel = control.id
        ? labelsById.get(control.id)
        : undefined;
      const visualLabel = control.closest('label') ?? explicitLabel;
      if (!visualLabel) return false;
      const labelStyle = window.getComputedStyle(visualLabel);
      const labelRect = visualLabel.getBoundingClientRect();
      return labelStyle.display !== 'none' && labelStyle.visibility !== 'hidden' && labelRect.width > 0 && labelRect.height > 0;
    });

    // IDs are scoped to the current visible step. Clear prior-step IDs so a
    // hidden control cannot collide with a newly visible control.
    const formRoots = [
      ...document.querySelectorAll(
        'form, [role="form"], .cmp-adaptiveform-container, [class*="adaptiveform-container"], [class*="form-container"]'
      )
    ];
    const candidates = formRoots
      .map(root => ({
        root,
        controls: visibleControls.filter(control => root.contains(control))
      }))
      .filter(candidate => candidate.controls.length > 0)
      .sort((left, right) => right.controls.length - left.controls.length);

    // Some AEM form components render their controls in a form-like DIV or
    // use a zero-sized/display:contents <form> wrapper. When no explicit root
    // is discoverable, visible controls are still stronger evidence of a form
    // than the presence of a literal <form> tag alone.
    const activeForm = candidates[0] ?? (visibleControls.length > 0
      ? { root: document.body, controls: visibleControls }
      : undefined);

    const selectedControls = new Set(activeForm?.controls ?? []);
    elements.forEach(element => {
      if (!selectedControls.has(element) && element.hasAttribute('data-mlr-field-id')) element.removeAttribute('data-mlr-field-id');
    });
    document.querySelectorAll('[data-mlr-active-form]').forEach(root => {
      if (root !== activeForm?.root) root.removeAttribute('data-mlr-active-form');
    });
    if (!activeForm) return [];
    if (activeForm.root.getAttribute('data-mlr-active-form') !== 'true') activeForm.root.setAttribute('data-mlr-active-form', 'true');

    const radioGroups = new Map<string, HTMLInputElement[]>();
    for (const element of activeForm.controls) {
      if (!(element instanceof HTMLInputElement) || element.type.toLowerCase() !== 'radio') continue;
      const key = element.name || element.id;
      if (key) radioGroups.set(key, [...(radioGroups.get(key) ?? []), element]);
    }
    const radioQuestions = new Map<string, string>();
    for (const [key, group] of radioGroups) {
      const first = group[0];
      if (!first) continue;
      let root = first.parentElement;
      while (root && !group.every(control => root!.contains(control))) root = root.parentElement;
      if (!root) continue;
      const labelledBy = root.getAttribute('aria-labelledby');
      let question = labelledBy ? document.getElementById(labelledBy)?.textContent?.trim() ?? '' : '';
      question ||= root.getAttribute('aria-label')?.trim() ?? '';
      question ||= root.querySelector('legend, [class*="question"], [class*="Question"]')?.textContent?.trim() ?? '';
      if (!question) {
        let remaining = root.textContent ?? '';
        for (const control of group) {
          const optionLabel = (control.closest('label') ?? (control.id ? labelsById.get(control.id) : undefined))?.textContent?.trim();
          if (optionLabel) remaining = remaining.replace(optionLabel, ' ');
        }
        question = remaining.replace(/\s+/gu, ' ').trim();
      }
      if (!question) question = root.previousElementSibling?.textContent?.replace(/\s+/gu, ' ').trim() ?? '';
      if (question && question.length <= 300) radioQuestions.set(key, question);
    }

    return activeForm.controls
      .map((element, index) => {
        const control = element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        const generatedId = `mlr-field-${index}`;
        if (control.dataset.mlrFieldId !== generatedId) control.dataset.mlrFieldId = generatedId;
        const explicitLabel = control.id
          ? labelsById.get(control.id)?.textContent
          : undefined;
        const wrappingLabel = control.closest('label')?.textContent;
        const ariaLabel = control.getAttribute('aria-label');
        const nearbyText = control.parentElement?.textContent;
        let relatedQuestion = '';
        if (control instanceof HTMLSelectElement && !explicitLabel && !wrappingLabel && !ariaLabel) {
          let ancestor: Element | null = control;
          for (let depth = 0; depth < 6 && ancestor && !relatedQuestion; depth += 1, ancestor = ancestor.parentElement) {
            const previous = ancestor.previousElementSibling;
            if (!previous || getComputedStyle(previous).display === 'none') continue;
            const text = previous.textContent?.replace(/\s+/gu, ' ').trim() ?? '';
            relatedQuestion = text.match(/[^?]{3,200}\?/u)?.[0]?.trim() ?? '';
          }
        }
        const label = (explicitLabel?.trim() || wrappingLabel?.trim() || ariaLabel?.trim() || control.getAttribute('placeholder')?.trim() || relatedQuestion || nearbyText?.trim() || control.name || generatedId)
          .replace(/\s+/gu, ' ')
          .trim()
          .slice(0, 200);
        const checkboxGroup = control instanceof HTMLInputElement && control.type.toLowerCase() === 'checkbox'
          ? control.closest('.cmp-adaptiveform-checkboxgroup') : null;
        const checkboxQuestionText = checkboxGroup?.parentElement?.previousElementSibling?.textContent ?? '';
        const checkboxQuestion = checkboxQuestionText.match(/[^?]{3,200}\?/u)?.[0]?.replace(/\s+/gu, ' ').trim();

        const base = {
          id: generatedId,
          domId: control.id || undefined,
          frameUrl: sourceFrameUrl || undefined,
          tag: control.tagName.toLowerCase() as 'input' | 'select' | 'textarea',
          type: control instanceof HTMLInputElement ? control.type.toLowerCase() : control.tagName.toLowerCase(),
          label,
          question: control instanceof HTMLInputElement && control.type.toLowerCase() === 'radio'
            ? radioQuestions.get(control.name || control.id) : checkboxQuestion,
          choiceValue: control instanceof HTMLInputElement && ['radio', 'checkbox'].includes(control.type.toLowerCase())
            ? control.value
            : undefined,
          groupRequired: checkboxGroup
            ? checkboxGroup.hasAttribute('required') || checkboxGroup.getAttribute('data-cmp-required') === 'true'
            : undefined,
          name: control.name || undefined,
          placeholder: control.getAttribute('placeholder') || undefined,
          autocomplete: control.getAttribute('autocomplete') || undefined,
          required: control.required,
          disabled: control.disabled,
          readOnly: 'readOnly' in control ? control.readOnly : false,
          minLength: control.getAttribute('minlength') ? Number(control.getAttribute('minlength')) : undefined,
          maxLength: control.getAttribute('maxlength') ? Number(control.getAttribute('maxlength')) : undefined,
          min: control.getAttribute('min') || undefined,
          max: control.getAttribute('max') || undefined,
          pattern: control.getAttribute('pattern') || undefined
        };

        if (control instanceof HTMLSelectElement) {
          return {
            ...base,
            options: [...control.options]
              .filter(option => !option.disabled)
              .map(option => ({ value: option.value, label: option.text.trim() }))
          };
        }
        return base;
      });
  }, frameUrl);
}

export function fieldSignature(fields: FormField[]): string {
  // AEM can move the same logical form between frame documents or change an
  // iframe URL while loading a condition. That alone is not form progress.
  return fields.map(field => `${field.name ?? field.id}:${field.label}:${field.type}`).join('|');
}

/** Wait for client-rendered form controls to appear and stop changing. */
export async function waitForStableFormFields(
  page: Page,
  options: { timeoutMs: number; minimumWaitMs?: number; pollMs?: number; stablePolls?: number }
): Promise<FormField[]> {
  const startedAt = Date.now();
  const minimumWaitMs = options.minimumWaitMs ?? 2_500;
  const pollMs = options.pollMs ?? 500;
  const stablePolls = options.stablePolls ?? 3;
  let latest: FormField[] = [];
  let previousSignature = '';
  let unchangedPolls = 0;

  while (Date.now() - startedAt < options.timeoutMs) {
    try { latest = await extractVisibleFields(page); }
    catch (error) {
      if (!(error instanceof FieldScanPendingError)) throw error;
      if (Date.now() - startedAt >= options.timeoutMs) throw error;
      continue;
    }
    const signature = fieldSignature(latest);
    unchangedPolls = signature && signature === previousSignature ? unchangedPolls + 1 : 0;
    previousSignature = signature;
    if (latest.length > 0 && Date.now() - startedAt >= minimumWaitMs && unchangedPolls >= stablePolls) {
      return latest;
    }
    await page.waitForTimeout(pollMs);
  }
  // Check once more after the final polling delay. A late iframe can become
  // interactive between the last loop condition and the timeout boundary.
  return extractVisibleFields(page);
}

import type { Frame, Locator, Page } from 'playwright';
import type { FormField } from '../types.js';

function resolveFrame(page: Page, frameUrl?: string): Frame {
  if (!frameUrl) return page.mainFrame();
  const frame = page.frames().find(candidate => {
    if (candidate.isDetached()) return false;
    if (candidate.url() === frameUrl) return true;
    try {
      const expected = new URL(frameUrl);
      const actual = new URL(candidate.url());
      return actual.origin === expected.origin && actual.pathname === expected.pathname;
    } catch {
      return false;
    }
  });
  if (!frame) throw new Error(`The form frame is no longer available: ${frameUrl}`);
  return frame;
}

async function resolveFieldControl(
  page: Page,
  field: FormField,
  timeoutMs = 10_000
): Promise<{ frame: Frame; locator: Locator }> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const liveFrames = page.frames().filter(frame => !frame.isDetached());
    const preferredFrames = field.frameUrl
      ? liveFrames.filter(frame => {
          try {
            const expected = new URL(field.frameUrl!);
            const actual = new URL(frame.url());
            return frame.url() === field.frameUrl || (
              actual.origin === expected.origin && actual.pathname === expected.pathname
            );
          } catch {
            return false;
          }
        })
      : [page.mainFrame()];
    const orderedFrames = [...preferredFrames, ...liveFrames.filter(frame => !preferredFrames.includes(frame))];

    for (const frame of orderedFrames) {
      const selectors = [
        `[data-mlr-field-id=${JSON.stringify(field.id)}]`,
        field.label ? `${field.tag}[aria-label=${JSON.stringify(field.label)}]` : undefined,
        field.name ? `${field.tag}[name=${JSON.stringify(field.name)}]` : undefined
      ].filter((selector): selector is string => Boolean(selector));
      for (const selector of selectors) {
        const locator = frame.locator(selector);
        const count = await locator.count().catch(() => 0);
        for (let index = 0; index < count; index += 1) {
          const item = locator.nth(index);
          if (await item.isVisible().catch(() => false)) return { frame, locator: item };
          if (field.type === 'checkbox' || field.type === 'radio') {
            // AbbVie/AEM themes frequently hide the native choice input and
            // expose only its wrapping/for= label. The extractor intentionally
            // includes those controls, so reacquisition must use the same
            // visibility rule rather than requiring the input itself to show.
            const hasVisibleMatchingLabel = await item.evaluate((element, expectedLabel) => {
              const input = element as HTMLInputElement;
              const explicitLabel = input.id
                ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`)
                : undefined;
              const label = input.closest('label') ?? explicitLabel;
              if (!label) return false;
              const style = window.getComputedStyle(label);
              const rect = label.getBoundingClientRect();
              const visible = style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
              const actual = (label.textContent ?? '').replace(/\s+/gu, ' ').trim().toLowerCase();
              const expected = expectedLabel.replace(/\s+/gu, ' ').trim().toLowerCase();
              return visible && (actual.includes(expected) || expected.includes(actual));
            }, field.label).catch(() => false);
            if (hasVisibleMatchingLabel) return { frame, locator: item };
          }
        }
      }

      // AEM can regenerate temporary IDs and names while retaining the
      // authored label/placeholder. Semantic locators follow wrapping labels,
      // label[for], and ARIA relationships across those rerenders.
      const semanticLocators = [
        field.label ? frame.getByLabel(field.label, { exact: true }) : undefined,
        field.label ? frame.getByLabel(field.label, { exact: false }) : undefined,
        field.placeholder ? frame.getByPlaceholder(field.placeholder, { exact: true }) : undefined
      ].filter((locator): locator is Locator => Boolean(locator));
      for (const locator of semanticLocators) {
        const count = await locator.count().catch(() => 0);
        for (let index = 0; index < count; index += 1) {
          const item = locator.nth(index);
          const tagName = await item.evaluate(element => element.tagName.toLowerCase()).catch(() => '');
          if (tagName !== field.tag) continue;
          if (await item.isVisible().catch(() => false)) return { frame, locator: item };
        }
      }
    }
    await page.waitForTimeout(250);
  }
  throw new Error(`The current form control could not be reacquired: ${field.label}`);
}

export async function readFieldValue(page: Page, field: FormField): Promise<string> {
  const { locator } = await resolveFieldControl(page, field, 1_000);
  return ['checkbox', 'radio'].includes(field.type)
    ? String(await isChoiceChecked(locator))
    : locator.inputValue();
}

export async function fillFields(
  page: Page,
  fields: FormField[],
  values: Map<string, string>,
  options: { forceChoiceEvent?: boolean; settleAfterEachFieldMs?: number } = {}
): Promise<void> {
  // Fill stable text controls before selects and choices. Select/radio/
  // checkbox changes can rebuild an AEM step and invalidate later locators.
  const orderedFields = [...fields].sort((left, right) => {
    const priority = (field: FormField) => field.type === 'checkbox' || field.type === 'radio'
      ? 2
      : field.tag === 'select'
        ? 1
        : 0;
    return priority(left) - priority(right);
  });
  for (const field of orderedFields) {
    if (field.disabled || field.readOnly || ['hidden', 'submit', 'button', 'file'].includes(field.type)) continue;
    const value = values.get(field.id);
    if (value === undefined) continue;
    if (field.tag === 'select') {
      const matchingOption = field.options?.find(option => option.value === value || option.label === value);
      if (!matchingOption) throw new Error(`No matching option for ${field.label}.`);
      await applySelectValue(page, field, matchingOption.value);
    } else if (field.type === 'checkbox' || field.type === 'radio') {
      const { frame, locator } = await resolveFieldControl(page, field);
      const checked = value === 'true';
      // A radio cannot be cleared directly. Selecting the requested true
      // option clears its siblings, so false-valued radio fields are skipped.
      if (field.type === 'radio' && !checked) continue;
      if (await isChoiceChecked(locator) === checked && !options.forceChoiceEvent) continue;

      await applyChoiceState(frame, locator, field.label, checked, options.forceChoiceEvent ?? false);
      if (await isChoiceChecked(locator) !== checked) {
        throw new Error(`Unable to ${checked ? 'check' : 'clear'} ${field.label}.`);
      }
    } else {
      await applyTextValue(page, field, value);
    }
    if ((options.settleAfterEachFieldMs ?? 0) > 0) {
      // Text filling already awaits the browser action and verifies its value.
      // Only choices need the caller's conditional-render settling allowance.
      const canChangeFormShape = field.tag === 'select' || ['radio', 'checkbox'].includes(field.type);
      if (canChangeFormShape) await page.waitForTimeout(options.settleAfterEachFieldMs!);
    }
  }
}

async function applyTextValue(page: Page, field: FormField, value: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const { locator } = await resolveFieldControl(page, field, 5_000);
      const currentValue = await locator.inputValue();
      if (currentValue === value || (field.type === 'tel' &&
        currentValue.replace(/\D/gu, '') === value.replace(/\D/gu, ''))) return;
      // A dependent control can become readonly after extraction. For example,
      // "Same as primary phone number" fills and locks RINVOQ's mobile input.
      // The site's populated value is authoritative; writing the earlier AI
      // value into it would stall Playwright and undo the user's choice.
      if (!await locator.isEditable()) {
        if (currentValue.trim()) return;
        throw new Error(`${field.label} is locked and empty after the form changed.`);
      }
      await locator.fill(value, { timeout: 5_000 });
      if (await locator.inputValue().catch(() => value) === value) return;
    } catch (error) {
      lastError = error;
      if (error instanceof Error && / is locked and empty after the form changed\./u.test(error.message)) break;
    }
    await page.waitForTimeout(250 * attempt);
  }
  const detail = lastError instanceof Error ? ` ${lastError.message}` : '';
  throw new Error(`Unable to fill ${field.label}.${detail}`);
}

async function applySelectValue(page: Page, field: FormField, value: string): Promise<void> {
  let lastError: unknown;
  let selectionWasAttempted = false;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const { locator } = await resolveFieldControl(page, field, 5_000);

      // AEM briefly disables its native select while synchronizing the form
      // model. Do not spend Playwright's full default timeout on that state.
      selectionWasAttempted = true;
      try {
        await locator.selectOption(value, { timeout: 3_000 });
        // selectOption resolving means the value and change events were
        // applied. AEM may detach the iframe immediately afterward, so do not
        // require the old locator to remain alive for verification.
        return;
      } catch (error) {
        lastError = error;
      }
      if (await locator.inputValue().catch(() => undefined) === value) return;

      // Some AEM themes place the real select behind a custom widget. A
      // forced native selection still emits the browser events AEM expects.
      try {
        await locator.selectOption(value, { force: true, timeout: 2_000 });
        return;
      } catch (error) {
        lastError = error;
      }
      if (await locator.inputValue().catch(() => undefined) === value) return;

      // Final compatibility path for a disabled native widget. Set the value
      // and emit both events so the Adaptive Forms model renders the branch.
      const applied = await locator.evaluate((element, nextValue) => {
        const select = element as HTMLSelectElement;
        if (![...select.options].some(option => option.value === nextValue)) return false;
        select.value = nextValue;
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return select.value === nextValue;
      }, value).catch(error => {
        lastError = error;
        return false;
      });
      if (applied) return;
    } catch (error) {
      lastError = error;
      if (
        selectionWasAttempted &&
        error instanceof Error &&
        /could not be reacquired|frame is no longer available|frame was detached/iu.test(error.message)
      ) {
        // The selection commonly causes AEM to replace the entire iframe.
        // The branch runner will now wait for and verify the expected next
        // control, which is stronger evidence than inspecting a stale select.
        return;
      }
    }
    await page.waitForTimeout(250 * attempt);
  }

  const detail = lastError instanceof Error ? ` ${lastError.message}` : '';
  throw new Error(`Unable to select ${field.label}.${detail}`);
}

async function isChoiceChecked(locator: Locator): Promise<boolean> {
  const nativeChecked = await locator.isChecked().catch(() => false);
  if (nativeChecked) return true;
  return await locator.getAttribute('aria-checked').catch(() => null) === 'true';
}

async function applyChoiceState(
  frame: Frame,
  locator: Locator,
  label: string,
  checked: boolean,
  forceEvent = false
): Promise<void> {
  if (forceEvent && await isChoiceChecked(locator) === checked) {
    await locator.evaluate((element, nextChecked) => {
      const input = element as HTMLInputElement;
      input.checked = nextChecked;
      input.setAttribute('aria-checked', String(nextChecked));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, checked);
    await frame.page().waitForTimeout(100);
    return;
  }
  // Adobe Adaptive Forms can expose a visible native input whose click is
  // intercepted by the component. Try Playwright's native action, but never
  // let that exception prevent the component-aware fallbacks below.
  if (await locator.isVisible().catch(() => false)) {
    await locator.setChecked(checked, { timeout: 1_500 }).catch(() => undefined);
    if (await isChoiceChecked(locator) === checked) return;
  }

  const candidates: Locator[] = [
    locator.locator('xpath=ancestor::label[1]'),
    frame.locator('label').filter({ hasText: label })
  ];
  const describedBy = (await locator.getAttribute('aria-describedby').catch(() => null))
    ?.split(/\s+/)
    .filter(Boolean) ?? [];
  for (const id of describedBy) {
    candidates.push(frame.locator(`[id=${JSON.stringify(id)}]`));
  }

  for (const candidate of candidates) {
    const count = await candidate.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const item = candidate.nth(index);
      if (!await item.isVisible().catch(() => false)) continue;
      await item.click({ timeout: 1_500 }).catch(() => undefined);
      await frame.page().waitForTimeout(100);
      if (await isChoiceChecked(locator) === checked) return;
    }
  }

  await locator.setChecked(checked, { force: true, timeout: 1_500 }).catch(() => undefined);
  if (await isChoiceChecked(locator) === checked) return;

  // Last-resort compatibility path for custom AEM widgets. Updating the
  // native property and emitting the same bubbling events preserves the form
  // model's change listeners when the visual widget absorbs every click.
  await locator.evaluate((element, nextChecked) => {
    const input = element as HTMLInputElement;
    input.checked = nextChecked;
    input.setAttribute('aria-checked', String(nextChecked));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, checked).catch(() => undefined);
  await frame.page().waitForTimeout(100);
}

/**
 * Selects a scenario branch that must be chosen before field extraction.
 * Linzess displays the new-card fields by default, while the existing-card
 * button swaps in a different form step.
 */
export async function selectScenarioBranch(page: Page, scenario: string): Promise<string | undefined> {
  if (scenario !== 'savings-card-existing') return undefined;

  const branch = await firstVisible([
    page.getByRole('button', { name: /activate existing card/i }),
    page.getByRole('link', { name: /activate existing card/i })
  ]);
  if (!branch) return undefined;

  const label = (await branch.innerText()).trim();
  await branch.click();
  await page.waitForTimeout(250);
  return label;
}

async function firstVisible(locators: Locator[]): Promise<Locator | undefined> {
  for (const locator of locators) {
    const count = await locator.count();
    for (let index = 0; index < count; index += 1) {
      const item = locator.nth(index);
      if (await item.isVisible()) return item;
    }
  }
  return undefined;
}

export async function findFormAction(page: Page, fields: FormField[] = []): Promise<{
  locator?: Locator;
  kind: 'next' | 'submit' | 'none';
  label?: string;
}> {
  const frame = resolveFrame(page, fields.find(field => field.frameUrl)?.frameUrl);
  const activeForm = frame.locator('[data-mlr-active-form="true"]');
  const roots: Array<Frame | Locator> = await activeForm.count() > 0 ? [activeForm, frame] : [frame];
  for (const root of roots) {
    const next = await firstVisible([
      root.getByRole('button', { name: /next|continue|proceed|verify|look up|login|log in|sign in|start|begin/i }),
      root.getByRole('link', { name: /next|continue|proceed|verify|look up|login|log in|sign in|start|begin/i })
    ]);
    if (next) return { locator: next, kind: 'next', label: (await next.innerText()).trim() };

    const submit = await firstVisible([
      root.locator('button[type="submit"]'),
      root.locator('input[type="submit"]'),
      // Adobe Adaptive Forms commonly uses type="button" plus a submit class.
      root.locator('button.cmp-adaptiveform-button__widget.submit'),
      root.getByRole('button', { name: /submit|register|send|finish|complete|results|save|apply|redeem|request|get new card|activate card/i })
    ]);
    if (submit) {
      const label = ((await submit.innerText().catch(() => '')) || (await submit.getAttribute('value')) || 'Submit').trim();
      return { locator: submit, kind: 'submit', label };
    }
  }
  return { kind: 'none' };
}

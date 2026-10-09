import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { assertSafeUrl } from '../security/url-policy.js';
import type { DataGenerator } from '../claude/data-generator.js';
import { detectCaptcha } from '../form/captcha.js';
import { DeterministicDataGenerator } from '../form/deterministic-data-generator.js';
import { fillFields, findFormAction, readFieldValue, selectScenarioBranch } from '../form/executor.js';
import { discoverFormActions } from '../form/action-discovery.js';
import { fieldMemoryKey, retainedValues } from '../form/guided-values.js';
import { readFormErrors } from '../form/form-errors.js';
import {
  detectFormPresence,
  extractVisibleFieldCandidates,
  extractVisibleFields,
  fieldSignature,
  FieldScanPendingError,
  waitForStableFormFields
} from '../form/field-extractor.js';
import { conformGeneratedValues, validateGeneratedValues } from '../form/field-validation.js';
import { validateOutcome } from '../form/outcome-validator.js';
import { resolvePayloadValues } from '../form/payload.js';
import type { RunStore } from '../storage/run-store.js';
import type { FormField, GeneratedValue, RunRecord } from '../types.js';
import { StepInput } from './step-input.js';
import { editableFields } from '../form/step-workbook.js';
import { isConditionalChoice, needsHumanInput, pairedEmailFields } from '../form/human-input.js';
import { captureActionNetwork } from './action-network.js';
import { terminalColor, type LogTone } from '../terminal-colors.js';

async function waitForFieldChange(
  page: Page,
  previousSignature: string,
  timeoutMs: number
): Promise<FormField[] | undefined> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const fields = await extractVisibleFields(page);
    if (fields.length > 0 && fieldSignature(fields) !== previousSignature) {
      return waitForStableFormFields(page, {
        timeoutMs: Math.max(1_000, timeoutMs - (Date.now() - startedAt)),
        minimumWaitMs: 500,
        pollMs: 250,
        stablePolls: 2
      });
    }
    await page.waitForTimeout(250);
  }
  return undefined;
}

async function workflowStateSignature(page: Page, fields?: FormField[]): Promise<string> {
  const visibleFields = fields ?? await extractVisibleFields(page);
  // Only form-related state belongs in this signature. Advertising and
  // analytics iframes are highly dynamic and previously caused the wait to
  // finish while the actual form was still showing a loading indicator.
  return `${page.url()}::${fieldSignature(visibleFields)}`;
}

async function hasVerificationAction(page: Page, fields: FormField[]): Promise<boolean> {
  if (/rebate|verify|verification|otp/iu.test(page.url())) return true;
  const source = fields[0]?.frameUrl;
  const frame = source ? page.frames().find(candidate => candidate.url() === source) : page.mainFrame();
  if (!frame) return false;
  try {
    return await frame.locator('button, input[type="submit"], [role="button"]').evaluateAll(elements =>
      elements.some(element => /(?:send|verify|request|receive|get).{0,30}(?:code|otp|email|phone)/iu.test(
        `${element.textContent ?? ''} ${(element as HTMLInputElement).value ?? ''}`)));
  } catch {
    return false;
  }
}

async function waitForWorkflowStateChange(
  page: Page,
  previousSignature: string,
  timeoutMs: number
): Promise<FormField[]> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const fields = await extractVisibleFields(page);
    if (fields.length > 0 && await workflowStateSignature(page, fields) !== previousSignature) {
      return waitForStableFormFields(page, {
        timeoutMs: Math.max(1_000, timeoutMs - (Date.now() - startedAt)),
        minimumWaitMs: 500,
        pollMs: 250,
        stablePolls: 2
      });
    }
    await page.waitForTimeout(250);
  }
  return extractVisibleFields(page);
}

async function waitForPostAction(
  page: Page,
  previousSignature: string,
  previousUrl: string,
  expectedOutcome: RunRecord['request']['expectedOutcome'],
  timeoutMs: number,
  slowConfirmationTimeoutMs = timeoutMs
): Promise<{
  fields: FormField[];
  outcome: Awaited<ReturnType<typeof validateOutcome>>;
}> {
  const startedAt = Date.now();
  let waitUntil = startedAt + timeoutMs;
  while (Date.now() < waitUntil) {
    const outcome = await validateOutcome(page, expectedOutcome, previousUrl);
    // A submit can redirect to another form. Treat text/selector evidence as
    // terminal, but keep waiting for destination form controls after a URL
    // change before deciding that the redirect completed the workflow.
    if (outcome.matched && outcome.type !== 'redirect') return { fields: [], outcome };
    if (outcome.type === 'redirect' && /\/(?:confirmation|thank-you|thankyou|success)(?:[/?#]|$)/iu.test(page.url())) {
      waitUntil = Math.max(waitUntil, startedAt + slowConfirmationTimeoutMs);
    }

    const fields = await extractVisibleFields(page);
    // An empty field set is commonly a transient loading spinner between AEM
    // steps. Keep waiting for either a confirmation/redirect or stable fields.
    if (fields.length > 0 && await workflowStateSignature(page, fields) !== previousSignature) {
      const stableFields = await waitForStableFormFields(page, {
        timeoutMs: Math.max(1_000, waitUntil - Date.now()),
        minimumWaitMs: 500,
        pollMs: 250,
        stablePolls: 2
      });
      return {
        fields: stableFields,
        outcome: { matched: false }
      };
    }
    await page.waitForTimeout(250);
  }
  const fields = await extractVisibleFields(page);
  if (fields.length > 0 && await workflowStateSignature(page, fields) !== previousSignature) {
    return { fields, outcome: { matched: false } };
  }
  const outcome = await validateOutcome(page, expectedOutcome, previousUrl);
  return { fields, outcome: outcome.type === 'redirect' ? { matched: false } : outcome };
}

function failedSiteRequests(diagnostics: RunRecord['networkDiagnostics'], siteUrl: string): string[] {
  const hostname = new URL(siteUrl).hostname;
  return (diagnostics ?? []).filter(item => item.status !== undefined && item.status >= 400 &&
    new URL(item.endpoint).hostname === hostname).map(item => {
      const path = new URL(item.endpoint).pathname;
      return `${item.method} ${path}: HTTP ${item.status}`;
    });
}

function artifactSegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '').slice(0, 60) || 'option';
}

export type BranchChoice = {
  kind: 'select' | 'radio' | 'checkbox';
  groupKey: string;
  label: string;
  value: string;
};

export type BranchGroup = {
  kind: 'select' | 'radio' | 'checkbox';
  groupKey: string;
  label: string;
  options: Array<{ label: string; value: string }>;
};

class BranchLeafNotReadyError extends Error {
  constructor(readonly branchPath: string) {
    super(`No downstream form fields rendered for branch ${branchPath}.`);
    this.name = 'BranchLeafNotReadyError';
  }
}

function fieldGroupKey(field: FormField): string | undefined {
  // Frame URLs can change when an AEM form changes condition. The extractor
  // already returns controls from one active form frame, so name/label is a
  // more reliable identity for replay than the transient frame URL.
  if (field.tag === 'select') return `select:${field.name ?? field.label}`;
  if (field.type === 'radio') return `radio:${field.name ?? field.label}`;
  if (field.type === 'checkbox') return `checkbox:${field.name ?? field.label}`;
  return undefined;
}

function choiceBeforeNewFields(before: FormField[], after: FormField[], choices: FormField[]): FormField[] | undefined {
  const beforeKeys = new Set(before.map(fieldMemoryKey));
  const newFieldIndex = after.findIndex(field => !beforeKeys.has(fieldMemoryKey(field)));
  if (newFieldIndex < 0) return undefined;
  for (let index = newFieldIndex - 1; index >= 0; index -= 1) {
    const field = after[index]!;
    if (field.tag !== 'select' && !['radio', 'checkbox'].includes(field.type)) continue;
    // Multi-select quiz answers can reveal the next question without becoming
    // a user routing decision. Do not attribute that progression to a radio
    // farther back in the form.
    if (field.type === 'checkbox') return undefined;
    const key = fieldGroupKey(field);
    const group = choices.filter(choice => fieldGroupKey(choice) === key);
    return group.length ? group : undefined;
  }
  return undefined;
}

/**
 * A branch gate is a screen whose as-yet-unanswered controls are one select
 * or one radio group. This avoids exploding ordinary data selects such as
 * State into branches once text/address fields are also visible.
 */
export function discoverBranchGroup(fields: FormField[], path: BranchChoice[], payload?: Record<string, string>): BranchGroup | undefined {
  const group = discoverUnconstrainedBranchGroup(fields, path);
  if (!group || !payload) return group;
  const groupFields = fields.filter(field => fieldGroupKey(field) === group.groupKey);
  const supplied = new Map(resolvePayloadValues(groupFields, payload).map(item => [item.fieldId, item.value]));
  if (!supplied.size) return group;
  const options = group.options.filter(option => groupFields.some(field => group.kind === 'select'
    ? supplied.get(field.id) === option.value || supplied.get(field.id) === option.label
    : supplied.get(field.id) === 'true' && (field.choiceValue ?? field.label) === option.value));
  if (!options.length) throw new Error('Excel payload must select an available branch option.');
  return { ...group, options };
}

function discoverUnconstrainedBranchGroup(fields: FormField[], path: BranchChoice[]): BranchGroup | undefined {
  const answeredGroups = new Set(path.map(choice => choice.groupKey));
  const unansweredFields = fields.filter(field => {
    const groupKey = fieldGroupKey(field);
    return !groupKey || !answeredGroups.has(groupKey);
  });

  if (unansweredFields.length === 1 && unansweredFields[0]?.tag === 'select') {
    const select = unansweredFields[0];
    const options = select.options?.filter(option => option.value.trim() !== '') ?? [];
    const groupKey = fieldGroupKey(select);
    if (groupKey && options.length >= 2) {
      return { kind: 'select', groupKey, label: select.label, options };
    }
  }

  if (unansweredFields.length >= 2 && unansweredFields.every(field => field.type === 'radio')) {
    const groupKeys = new Set(unansweredFields.map(fieldGroupKey));
    const groupKey = unansweredFields[0] ? fieldGroupKey(unansweredFields[0]) : undefined;
    if (groupKeys.size === 1 && groupKey) {
      return {
        kind: 'radio',
        groupKey,
        label: unansweredFields[0]!.question ?? unansweredFields[0]!.name ?? unansweredFields[0]!.label,
        options: unansweredFields.map(field => ({
          label: field.label,
          value: field.choiceValue ?? field.label
        }))
      };
    }
  }

  if (unansweredFields.length >= 2 && unansweredFields.every(field => field.type === 'checkbox')) {
    const groupKeys = new Set(unansweredFields.map(fieldGroupKey));
    const groupKey = unansweredFields[0] ? fieldGroupKey(unansweredFields[0]) : undefined;
    if (groupKeys.size === 1 && groupKey) {
      return {
        kind: 'checkbox',
        groupKey,
        label: unansweredFields[0]!.name ?? unansweredFields[0]!.label,
        options: unansweredFields.map(field => ({
          label: field.label,
          value: field.choiceValue ?? field.label
        }))
      };
    }
  }

  return undefined;
}

function branchPathLabel(path: BranchChoice[]): string {
  return path.map(choice => choice.label).join(' > ');
}

function branchPathArtifactName(path: BranchChoice[]): string {
  return path.map(choice => artifactSegment(choice.label)).join('__').slice(0, 180) || 'root';
}

function isTransientFormStateError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /could not be reacquired|form frame is no longer available|frame was detached|execution context was destroyed/iu.test(message);
}

function fieldsForBranchChoice(fields: FormField[], choice: BranchChoice): FormField[] {
  const exact = fields.filter(field => fieldGroupKey(field) === choice.groupKey);
  if (exact.length > 0) return exact;

  // Some AEM templates regenerate control names. Fall back to the option's
  // semantic label/value so a stable Yes/No decision can still be replayed.
  if (choice.kind === 'select') {
    const select = fields.find(field => field.tag === 'select' && field.options?.some(option =>
      option.value === choice.value || option.label === choice.label
    ));
    return select ? [select] : [];
  }
  if (choice.kind === 'checkbox') {
    const matchingCheckboxes = fields.filter(field => field.type === 'checkbox');
    if (matchingCheckboxes.length === 1) return matchingCheckboxes;
    const selectedCheckbox = matchingCheckboxes.find(field =>
      field.label.trim().toLowerCase() === choice.label.trim().toLowerCase()
    );
    if (!selectedCheckbox) return [];
    return fields.filter(field => field.type === 'checkbox' && field.name === selectedCheckbox.name);
  }
  const selectedRadio = fields.find(field =>
    field.type === 'radio' && (
      field.label.trim().toLowerCase() === choice.label.trim().toLowerCase() ||
      field.choiceValue === choice.value
    )
  );
  if (!selectedRadio) return [];
  return fields.filter(field => field.type === 'radio' && field.name === selectedRadio.name);
}

export function pdfScreenshotTitle(url: string, stage: string): string {
  const view = stage === 'form-ready'
    ? 'Initial View'
    : stage.includes('filled')
      ? 'Filled View'
      : stage === 'confirmation'
        ? 'Confirmation View'
        : 'Form View';
  return `${url} - Form ${view}`;
}

function logRun(runId: string, event: string, details: Record<string, unknown> = {}): void {
  const readableDetails = [
    details.step !== undefined ? `step=${details.step}` : undefined,
    details.attempt !== undefined ? `attempt=${details.attempt}` : undefined,
    details.httpStatus !== undefined ? `http=${details.httpStatus}` : undefined,
    details.delayMs !== undefined ? `retryIn=${details.delayMs}ms` : undefined,
    details.durationMs !== undefined ? `duration=${details.durationMs}ms` : undefined,
    details.depth !== undefined ? `depth=${details.depth}` : undefined,
    details.branch !== undefined
      ? `branch=${details.branch}${details.totalBranches ? `/${details.totalBranches}` : ''}`
      : undefined,
    details.branchLabel ? `branchName="${details.branchLabel}"` : undefined,
    details.path ? `path="${details.path}"` : undefined,
    details.fieldCount !== undefined ? `fields=${details.fieldCount}` : undefined,
    details.kind ? `action=${details.kind}` : undefined,
    details.label ? `label="${details.label}"` : undefined,
    details.stage ? `stage="${details.stage}"` : undefined,
    details.status ? `status=${details.status}` : undefined,
    details.frameCount !== undefined ? `frames=${details.frameCount}` : undefined,
    details.artifactCount !== undefined ? `artifacts=${details.artifactCount}` : undefined,
    details.errorCode ? `result=${details.errorCode}` : undefined,
    details.message ? `message="${details.message}"` : undefined,
    details.provider ? `provider=${details.provider}` : undefined,
    details.model ? `model=${details.model}` : undefined,
    details.fallbackProvider ? `fallback=${details.fallbackProvider}` : undefined,
    details.blocking !== undefined ? `blocking=${details.blocking}` : undefined,
    details.method ? `method=${details.method}` : undefined,
    details.restored !== undefined ? `restored=${details.restored}` : undefined,
    details.destinationHasForm !== undefined ? `destinationForm=${details.destinationHasForm}` : undefined,
    details.outcomeType ? `outcome=${details.outcomeType}` : undefined,
    details.url ? `url=${details.url}` : undefined
  ].filter(Boolean).join(' | ');
  const failed = event.includes('FAILED') || details.status === 'failed';
  const warning = event.includes('SKIPPED') || event.includes('LIMIT') || details.status === 'inconclusive';
  const completed = /CAPTURED|CREATED|COMPLETED|FILLED|SELECTED/iu.test(event) || details.status === 'passed';
  const branch = event.includes('BRANCH');
  const tone: LogTone = failed
    ? 'red'
    : warning
      ? 'yellow'
      : completed
        ? 'green'
        : branch
          ? 'magenta'
          : /STARTED|LOADED|READY|DISCOVERED/iu.test(event)
            ? 'cyan'
            : 'blue';
  const humanLog = `[mlr-form] ${runId} | ${event.replaceAll('_', ' ').toLowerCase()}${readableDetails ? ` | ${readableDetails}` : ''}`;
  console.log(terminalColor(humanLog, tone));
  // Keep the structured line free of ANSI sequences for log ingestion.
  console.log(`[FORM_RUN] ${JSON.stringify({
    timestamp: new Date().toISOString(),
    runId,
    event,
    ...details
  })}`);
}

function fieldLogDetails(fields: FormField[]): Array<Record<string, unknown>> {
  return fields.map(field => ({
    name: field.name ?? field.id,
    label: field.label,
    tag: field.tag,
    type: field.type,
    required: field.required,
    frame: field.frameUrl ?? 'main'
  }));
}

export type RunnerOptions = {
  allowedTargetHosts: Set<string>;
  allowPrivateNetworks: boolean;
  headless: boolean;
  timeoutMs: number;
  formReadyTimeoutMs: number;
  initialFormReadyTimeoutMs?: number;
};
export class FormRunner {
  readonly stepInput: StepInput;
  private browser?: Browser;
  private readonly fallbackGenerator = new DeterministicDataGenerator();

  constructor(
    private readonly store: RunStore,
    private readonly generator: DataGenerator,
    private readonly options: RunnerOptions
  ) {
    this.stepInput = new StepInput(store);
  }

  async close(): Promise<void> {
    this.stepInput.close();
    await this.browser?.close();
  }

  async run(runId: string): Promise<void> {
    const record = this.requireRun(runId);
    logRun(runId, 'RUN_STARTED', {
      url: record.request.url,
      scenario: record.request.scenario,
      submitAuthorized: record.request.submit,
      maxSteps: record.request.maxSteps
    });
    await this.store.update(runId, {
      status: 'running',
      startedAt: new Date().toISOString(),
      dataGeneration: {
        provider: this.generator.provider,
        ...(this.generator.model ? { model: this.generator.model } : {}),
        requests: 0,
        validationRetries: 0,
        fallbackCount: 0
      }
    });

    let context: BrowserContext | undefined;
    const timeout = AbortSignal.timeout(this.options.timeoutMs);
    try {
      await assertSafeUrl(record.request.url, {
        allowedHosts: this.options.allowedTargetHosts,
        allowPrivateNetworks: this.options.allowPrivateNetworks,
        requireAllowedHost: this.options.allowedTargetHosts.size > 0
      });
      this.browser ??= await chromium.launch({
        headless: this.options.headless,
        ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
          : {})
      });
      context = await this.browser.newContext({
        viewport: { width: 1440, height: 1100 },
        locale: 'en-US',
        colorScheme: 'light',
        acceptDownloads: false
      });
      const page = await context.newPage();
      page.setDefaultTimeout(15_000);
      await this.installNetworkPolicy(page);
      if (timeout.aborted) throw new Error('Run timed out.');
      await this.navigateWithRetry(page, record.request.url, runId);
      logRun(runId, 'PAGE_LOADED', { url: page.url(), frameCount: page.frames().length });

      // The first form may be injected into an iframe long after the outer
      // page reaches DOMContentLoaded. Later transitions use the shorter
      // per-step timeout; only initial discovery gets the larger allowance.
      const initialReadyTimeoutMs = Math.max(this.options.formReadyTimeoutMs,
        this.options.initialFormReadyTimeoutMs ?? this.options.formReadyTimeoutMs);
      const initialWaitStartedAt = Date.now();
      const initialFields = await waitForStableFormFields(page, { timeoutMs: initialReadyTimeoutMs });
      logRun(runId, 'INITIAL_FIELDS_DETECTED', { fieldCount: initialFields.length,
        durationMs: Date.now() - initialWaitStartedAt });
      // A guided routing choice needs no full-page CAPTCHA/presence scan.
      // Publish the already-stable fields before doing unrelated inspection;
      // runExcelSteps still inspects CAPTCHA before every submission.
      if (['excel-steps', 'ai-guided'].includes(record.request.inputMode ?? '') && record.request.scenario === 'generic-form' && initialFields.length) {
        await this.store.update(runId, { formDetected: true });
        await this.runExcelSteps(page, runId, timeout, initialFields);
        return;
      }
      const formDetected = await detectFormPresence(page);
      await this.store.update(runId, { formDetected });
      logRun(runId, 'FORM_READY', { formDetected, frameCount: page.frames().length,
        fieldCount: initialFields.length, waitMs: Date.now() - initialWaitStartedAt,
        timeoutMs: initialReadyTimeoutMs });
      await this.inspectCaptcha(page, runId);

      const selectedBranch = await selectScenarioBranch(page, record.request.scenario);
      if (selectedBranch) {
        await waitForStableFormFields(page, {
          timeoutMs: this.options.formReadyTimeoutMs,
          minimumWaitMs: 500
        });
        await this.capture(page, runId, '00-scenario-branch', `scenario-branch:${selectedBranch}`);
      }

      if (['excel-steps', 'ai-guided'].includes(record.request.inputMode ?? '')) {
        await this.runExcelSteps(page, runId, timeout);
        return;
      }
      if (await this.captureInitialChoiceBranches(page, runId, timeout)) return;

      const seenSignatures = new Set<string>();
      for (let stepNumber = 1; stepNumber <= record.request.maxSteps; stepNumber += 1) {
        if (timeout.aborted) throw new Error('Run timed out.');

        const fields = await extractVisibleFields(page);
        logRun(runId, 'STEP_DISCOVERED', {
          step: stepNumber,
          url: page.url(),
          fieldCount: fields.length,
          fields: fieldLogDetails(fields)
        });
        const signature = `${page.url()}::${fieldSignature(fields)}`;
        const outcomeBeforeFill = await validateOutcome(page, record.request.expectedOutcome);
        if (outcomeBeforeFill.matched) {
          await this.completePassed(page, runId, outcomeBeforeFill);
          return;
        }
        if (fields.length === 0) {
          await this.capture(page, runId, `${stepNumber}-no-fields`, 'no-fields');
          await this.store.update(runId, {
            status: 'inconclusive',
            completedAt: new Date().toISOString(),
            error: { code: 'no_form_fields', message: 'No visible form fields or confirmation were found.' }
          });
          return;
        }
        if (seenSignatures.has(signature)) {
          await this.store.update(runId, {
            status: 'failed',
            completedAt: new Date().toISOString(),
            error: { code: 'step_did_not_advance', message: 'The form remained on the same step after an action.' }
          });
          return;
        }
        seenSignatures.add(signature);

        const step = { number: stepNumber, status: 'started' as const, fieldCount: fields.length };
        const current = this.requireRun(runId);
        await this.store.update(runId, {
          currentStep: stepNumber,
          steps: [...current.steps, step]
        });

        const values = await this.generateValidatedValues(runId, record.request.scenario, fields, `step-${stepNumber}`);
        await fillFields(page, fields, values, { settleAfterEachFieldMs: 5_000 });
        logRun(runId, 'STEP_FILLED', { step: stepNumber, fieldCount: fields.length });
        // Some forms reveal conditional questions immediately after a select,
        // radio, or checkbox changes. Record the transition without creating
        // an intermediate screenshot/PDF page.
        let changedFields = await waitForFieldChange(
          page,
          fieldSignature(fields),
          Math.min(5_000, this.options.formReadyTimeoutMs)
        );
        if (changedFields) {
          const latest = this.requireRun(runId);
          await this.store.update(runId, {
            steps: latest.steps.map(item =>
              item.number === stepNumber
                ? { ...item, status: 'completed', action: 'selection:auto-advanced' }
                : item
            )
          });
          continue;
        }

        const action = await findFormAction(page, fields);
        logRun(runId, 'ACTION_DISCOVERED', {
          step: stepNumber,
          kind: action.kind,
          label: action.label ?? null
        });
        if (!action.locator || action.kind === 'none') {
          // RINVOQ's indication selector has no Next button. Selecting a value
          // starts a delayed (roughly 4-5 second) iframe form render.
          if (fields.some(field => field.tag === 'select' || ['checkbox', 'radio'].includes(field.type))) {
            changedFields = await waitForFieldChange(page, fieldSignature(fields), this.options.formReadyTimeoutMs);
          }
          if (changedFields) {
            const latest = this.requireRun(runId);
            await this.store.update(runId, {
              steps: latest.steps.map(item =>
                item.number === stepNumber
                  ? { ...item, status: 'completed', action: 'selection:auto-advanced' }
                  : item
              )
            });
            continue;
          }
          const finalArtifact = await this.capture(page, runId, `${stepNumber}-filled`, `step-${stepNumber}-final-filled`);
          await this.store.update(runId, {
            status: 'inconclusive',
            completedAt: new Date().toISOString(),
            steps: this.requireRun(runId).steps.map(item => item.number === stepNumber
              ? { ...item, status: 'completed', action: 'filled:no-action', screenshot: finalArtifact.url }
              : item),
            error: { code: 'no_form_action', message: 'Fields were filled, but no Next or Submit action was found.' }
          });
          return;
        }
        const filledArtifact = action.kind === 'submit'
          ? await this.capture(page, runId, `${stepNumber}-filled`, `step-${stepNumber}-final-filled`)
          : undefined;
        if (action.kind === 'submit' && !record.request.submit) {
          logRun(runId, 'SUBMIT_SKIPPED', { step: stepNumber, reason: 'not-authorized' });
          const latest = this.requireRun(runId);
          await this.store.update(runId, {
            status: 'inconclusive',
            completedAt: new Date().toISOString(),
            steps: latest.steps.map(item =>
              item.number === stepNumber
                ? { ...item, status: 'completed', action: 'submit-not-authorized', screenshot: filledArtifact?.url }
                : item
            ),
            error: { code: 'submit_not_authorized', message: 'The form was filled but submission was not authorized.' }
          });
          return;
        }

        const captcha = await this.inspectCaptcha(page, runId);
        if (action.kind === 'submit' && captcha.detected && captcha.blocking) {
          await this.completeCaptchaBlocked(page, runId, stepNumber, filledArtifact?.url ?? '');
          return;
        }

        const stateBeforeAction = await workflowStateSignature(page, fields);
        const urlBeforeAction = page.url();
        const confirmationUrlBeforeAction = action.kind === 'submit' ? urlBeforeAction : undefined;
        logRun(runId, 'ACTION_CLICKED', { step: stepNumber, kind: action.kind, label: action.label ?? null });
        const transitionStartedAt = Date.now();
        logRun(runId, 'STATE_TRANSITION_WAIT_STARTED', {
          step: stepNumber,
          kind: action.kind,
          timeoutMs: this.options.formReadyTimeoutMs,
          url: page.url()
        });
        const observed = await captureActionNetwork(page, stepNumber, `${action.kind}:${action.label ?? ''}`, async () => {
          await action.locator!.click();
          await page.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => undefined);
          return waitForPostAction(page, stateBeforeAction, confirmationUrlBeforeAction ?? '',
            record.request.expectedOutcome, this.options.formReadyTimeoutMs,
            this.options.initialFormReadyTimeoutMs ?? this.options.formReadyTimeoutMs);
        });
        const transition = observed.result;
        await this.recordNetworkDiagnostics(runId, observed.diagnostics);
        if (
          action.kind === 'submit' &&
          transition.fields.length > 0 &&
          await workflowStateSignature(page, transition.fields) === stateBeforeAction
        ) {
          const captchaAfterSubmit = await this.inspectCaptcha(page, runId);
          if (captchaAfterSubmit.blocking) {
            await this.completeCaptchaBlocked(page, runId, stepNumber, filledArtifact?.url ?? '', true);
            return;
          }
          const siteErrors = await readFormErrors(page);
          const failedRequests = failedSiteRequests(observed.diagnostics, record.request.url);
          if (siteErrors.length || failedRequests.length) {
            const rejected = await this.capture(page, runId, `${stepNumber}-rejected`, `step-${stepNumber}-site-error`);
            await this.store.update(runId, {
              status: 'inconclusive',
              completedAt: new Date().toISOString(),
              steps: this.requireRun(runId).steps.map(item => item.number === stepNumber
                ? { ...item, status: 'completed', action: `${action.kind}:${action.label ?? ''}`, screenshot: rejected.url }
                : item),
              error: { code: 'site_rejected_submission', message: `The site kept the form open. ${
                [...siteErrors, ...failedRequests].join(' | ')}` }
            });
            return;
          }
        }
        logRun(runId, 'STATE_TRANSITION_COMPLETED', {
          step: stepNumber,
          url: page.url(),
          frameCount: page.frames().length,
          durationMs: Date.now() - transitionStartedAt,
          destinationHasForm: transition.fields.length > 0,
          outcomeType: transition.outcome.type ?? null
        });
        if (transition.outcome.matched) {
          await this.completePassed(page, runId, transition.outcome);
          return;
        }
        const latest = this.requireRun(runId);
        await this.store.update(runId, {
          steps: latest.steps.map(item =>
            item.number === stepNumber
              ? {
                  ...item,
                  status: 'completed',
                  action: `${action.kind}:${action.label ?? ''}`,
                  ...(filledArtifact ? { screenshot: filledArtifact.url } : {})
                }
              : item
          )
        });

        // A destination form means the submit was an intermediate step.
        if (transition.fields.length > 0) continue;

        const outcome = await validateOutcome(page, record.request.expectedOutcome, confirmationUrlBeforeAction);
        if (outcome.matched && outcome.type !== 'redirect') {
          await this.completePassed(page, runId, outcome);
          return;
        }
        if (action.kind === 'submit') {
          await this.capture(page, runId, `${stepNumber}-destination`, `step-${stepNumber}-destination`);
          await this.store.update(runId, {
            status: 'inconclusive',
            completedAt: new Date().toISOString(),
            confirmation: { matched: false },
            error: {
              code: 'post_submit_confirmation_not_found',
              message: 'The form was submitted, but no thank-you page, inline confirmation, or redirect was detected.'
            }
          });
          return;
        }
      }

      await this.store.update(runId, {
        status: 'failed',
        completedAt: new Date().toISOString(),
        error: { code: 'max_steps_exceeded', message: 'The form exceeded the configured maximum number of steps.' }
      });
    } catch (error) {
      logRun(runId, 'RUN_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown form-runner failure.'
      });
      await this.store.update(runId, {
        status: 'failed',
        completedAt: new Date().toISOString(),
        error: {
          code: error instanceof FieldScanPendingError ? 'field_scan_pending' : 'run_failed',
          message: error instanceof Error ? error.message : 'Unknown form-runner failure.'
        }
      });
    } finally {
      await context?.close();
      await this.createPdfArtifact(runId).catch(async error => {
        const current = this.store.get(runId);
        if (current && current.artifacts.some(item => item.contentType === 'image/png')) {
          await this.store.update(runId, {
            error: {
              code: 'pdf_generation_failed',
              message: error instanceof Error ? error.message : 'Unable to generate the form PDF.'
            }
          });
        }
      });
      const completed = this.store.get(runId);
      logRun(runId, 'RUN_FINISHED', {
        status: completed?.status,
        stepCount: completed?.steps.length ?? 0,
        artifactCount: completed?.artifacts.length ?? 0,
        errorCode: completed?.error?.code ?? null
      });
    }
  }

  /** Keep answers within a logical page; conditional controls are supplemental input. */
  private async runExcelSteps(page: Page, runId: string, timeout: AbortSignal, initialFields?: FormField[]): Promise<void> {
    const record = this.requireRun(runId);
    const aiGuided = record.request.inputMode === 'ai-guided';
    const expiresAt = new Date(Date.parse(record.startedAt!) + this.options.timeoutMs).toISOString();
    let stepNumber = 1;
    let stepToken = randomUUID();
    let issuedFieldsSignature = '';
    let attempt = 0;
    let unattendedRejections = 0;
    const memory = new Map<string, string>();
    const dependentChoiceKeys = new Set<string>();
    const discoveredChoiceKeys = new Set<string>();
    let correcting = false;
    let message = 'Download the Excel, fill the Value cells, then upload it to continue.';
    let readyFields = initialFields;
    while (stepNumber <= record.request.maxSteps) {
      let humanPromptedThisAttempt = false;
      let manualChoiceSubmitted = false;
      if (timeout.aborted) throw new Error('The browser session expired. Start a new run.');
      const fields = readyFields ?? await waitForStableFormFields(page, { timeoutMs: this.options.formReadyTimeoutMs, minimumWaitMs: 500 });
      readyFields = undefined;
      if (timeout.aborted) throw new Error('The browser session expired. Start a new run.');
      const branchGroup = discoverBranchGroup(fields, [], record.request.payload);
      const isRoutingChoice = branchGroup && (await discoverFormActions(page, fields)).length === 0;
      // A visible initial route selector is input, not a submission outcome.
      // Explicit outcome criteria still take precedence.
      const outcome = isRoutingChoice && stepNumber === 1 && !record.request.expectedOutcome
        ? { matched: false } : await validateOutcome(page, record.request.expectedOutcome);
      if (outcome.matched) { await this.completePassed(page, runId, outcome); return; }
      if (branchGroup && isRoutingChoice) {
        const options = branchGroup.options.map((option, index) => ({
          id: `choice-${index}`, label: option.label, kind: 'next' as const
        }));
        const selection = await this.stepInput.wait(runId, [], stepNumber, page.url(), timeout, expiresAt,
          `Select an option for "${branchGroup.label}" to load its form. ${aiGuided ? 'AI will fill general fields and ask you for choices and verification values.' : 'The Excel workbook appears after the form loads.'}`,
          randomUUID(), { kind: 'choice', actions: options,
            choiceType: branchGroup.kind, choiceLabel: branchGroup.label });
        const selectedIndex = options.findIndex(option => option.id === selection.actionId);
        const selectedOption = branchGroup.options[selectedIndex];
        if (!selectedOption) throw new Error('The selected form choice is no longer available.');
        const currentFields = await extractVisibleFields(page);
        const currentGroup = discoverBranchGroup(currentFields, [], record.request.payload);
        if (!currentGroup || currentGroup.groupKey !== branchGroup.groupKey ||
          !currentGroup.options.some(option => option.value === selectedOption.value)) {
          message = 'The available choices changed. Choose again to load the form.';
          continue;
        }
        const beforeChoice = await workflowStateSignature(page, currentFields);
        const choiceStartedAt = Date.now();
        logRun(runId, 'FORM_CHOICE_LOADING', { step: stepNumber, label: selectedOption.label, url: page.url() });
        await this.applyBranchChoice(page, currentFields.filter(field => fieldGroupKey(field) === currentGroup.groupKey), {
          kind: currentGroup.kind, groupKey: currentGroup.groupKey,
          label: selectedOption.label, value: selectedOption.value
        });
        const choiceTimeoutMs = Math.max(this.options.formReadyTimeoutMs,
          this.options.initialFormReadyTimeoutMs ?? this.options.formReadyTimeoutMs);
        const afterChoice = await waitForWorkflowStateChange(page, beforeChoice, choiceTimeoutMs);
        if (!afterChoice.length || await workflowStateSignature(page, afterChoice) === beforeChoice) {
          const evidence = await this.capture(page, runId, `${stepNumber}-choice-no-form`, `step-${stepNumber}-choice-no-form`);
          await this.store.update(runId, { status: 'inconclusive', completedAt: new Date().toISOString(),
            error: { code: 'choice_did_not_load_form',
              message: `The form for "${selectedOption.label}" did not appear after the selection. See ${evidence.name}.` } });
          return;
        }
        logRun(runId, 'FORM_CHOICE_SELECTED', { step: stepNumber, choice: selectedOption.label,
          fieldCount: afterChoice.length, durationMs: Date.now() - choiceStartedAt, url: page.url() });
        // The transition wait has already stabilized these fields. Reuse them
        // rather than doing a second full scan before offering the next input.
        readyFields = afterChoice;
        memory.clear();
        dependentChoiceKeys.clear();
        discoveredChoiceKeys.clear();
        const selectedFields = afterChoice.filter(field => fieldGroupKey(field) === currentGroup.groupKey);
        if (selectedFields.some(field => field.tag === 'select'
          ? field.options?.some(option => option.value === selectedOption.value)
          : (field.choiceValue ?? field.label) === selectedOption.value)) {
          for (const field of selectedFields) {
            const value = field.tag === 'select' ? selectedOption.value
              : String((field.choiceValue ?? field.label) === selectedOption.value);
            memory.set(fieldMemoryKey(field), value);
          }
        }
        stepToken = randomUUID();
        issuedFieldsSignature = '';
        correcting = false;
        message = aiGuided
          ? 'The selected form is ready. AI will fill general fields and ask for new choices or verification values.'
          : 'The selected form is ready. Download its Excel, fill the Value cells, then upload it.';
        continue;
      }
      attempt += 1;
      if (!editableFields(fields).length) {
        const captcha = await this.inspectCaptcha(page, runId);
        if (captcha.blocking) {
          await this.completeCaptchaBlocked(page, runId, stepNumber, '');
          return;
        }
        const evidence = await this.capture(page, runId, `${stepNumber}-no-fields`, `step-${stepNumber}-no-fields`);
        const siteErrors = await readFormErrors(page);
        await this.store.update(runId, {
          status: 'inconclusive',
          completedAt: new Date().toISOString(),
          error: {
            code: 'no_form_or_confirmation',
            message: siteErrors.length
              ? `The next screen had no editable form and reported: ${siteErrors.join(' | ')}`
              : `The next screen had no editable form, visible CAPTCHA challenge, or detectable confirmation. See ${evidence.name}.`
          }
        });
        return;
      }
      if (editableFields(fields).length > 500) throw new Error('The current page has more than 500 editable fields.');
      const existing = this.requireRun(runId);
      await this.store.update(runId, { currentStep: stepNumber, steps: [
        ...existing.steps.filter(step => step.number !== stepNumber),
        { ...existing.steps.find(step => step.number === stepNumber), number: stepNumber, status: 'started', fieldCount: editableFields(fields).length }
      ] });
      // This preview is optional: slow fonts or rendering must not delay input.
      await this.capture(page, runId, `${stepNumber}-${attempt}-input`,
        aiGuided ? `step-${stepNumber}-awaiting-input` : `step-${stepNumber}-awaiting-excel`, 5_000)
        .catch(error => logRun(runId, 'INPUT_PREVIEW_UNAVAILABLE', {
          step: stepNumber, message: error instanceof Error ? error.message : String(error)
        }));
      const urlBeforeFill = page.url();
      const signature = await workflowStateSignature(page, fields);
      const known = retainedValues(editableFields(fields), memory);
      const verificationFlow = aiGuided && editableFields(fields).some(field =>
        field.type === 'email' || field.type === 'tel' || /e.?mail|phone|mobile/iu.test(field.label))
        ? await hasVerificationAction(page, fields) : false;
      // Finish applying an uploaded workbook after each conditional rerender
      // before asking for all newly revealed controls together.
      const earlyRevealed = !correcting && known.size
        ? await this.fillRememberedFields(page, fields, memory, signature) : undefined;
      if (earlyRevealed) {
        if (aiGuided && page.url() === urlBeforeFill && fields.some(field =>
          known.has(field.id) && (isConditionalChoice(field) || discoveredChoiceKeys.has(fieldMemoryKey(field))))) {
          const before = new Set(fields.map(fieldMemoryKey));
          for (const field of earlyRevealed) {
            if (isConditionalChoice(field) && !before.has(fieldMemoryKey(field))) {
              dependentChoiceKeys.add(fieldMemoryKey(field));
            }
          }
        }
        if (page.url() !== urlBeforeFill) {
          await this.finishExcelStep(runId, stepNumber, 'selection:auto-advanced');
          memory.clear();
          dependentChoiceKeys.clear();
          discoveredChoiceKeys.clear();
          stepNumber += 1;
        }
        stepToken = randomUUID();
        message = aiGuided
          ? 'Additional fields appeared on this page. Your previous answers are retained. Enter the new requested values.'
          : 'Additional fields appeared on this page. Your previous answers are retained. Fill only the new fields in this Excel.';
        continue;
      }
      const requested = editableFields(fields).filter(field => !known.has(field.id) ||
        (correcting && (!aiGuided || (!isConditionalChoice(field) && !dependentChoiceKeys.has(fieldMemoryKey(field)) &&
          !discoveredChoiceKeys.has(fieldMemoryKey(field))))));
      let uploaded = new Map<string, string>();
      if (requested.length) {
        const requestedSignature = JSON.stringify(requested.map(field => [field.id, fieldMemoryKey(field)]));
        if (issuedFieldsSignature && requestedSignature !== issuedFieldsSignature) stepToken = randomUUID();
        issuedFieldsSignature = requestedSignature;
        if (aiGuided) {
          const pairedEmailIds = new Set(pairedEmailFields(fields).map(field => field.id));
          const humanFields = requested.filter(field => needsHumanInput(field, verificationFlow) ||
            pairedEmailIds.has(field.id) || dependentChoiceKeys.has(fieldMemoryKey(field)) ||
            discoveredChoiceKeys.has(fieldMemoryKey(field)));
          const generalFields = requested.filter(field => !humanFields.includes(field));
          if (generalFields.length) {
            uploaded = await this.generateValidatedValues(runId, record.request.scenario, generalFields, `step-${stepNumber}`);
            const generalChoices = generalFields.filter(field => field.tag === 'select' || ['radio', 'checkbox'].includes(field.type));
            await fillFields(page, generalFields.filter(field => !generalChoices.includes(field)), uploaded);
            // Try an uncertain choice before letting AI commit to it. A new
            // visible field is direct evidence that the choice controls a flow.
            let discoveredGroup: FormField[] | undefined;
            if (!correcting) {
              const groups = new Map<string, FormField[]>();
              for (const field of generalChoices.filter(field => field.tag === 'select' || field.type === 'radio')) {
                const identity = `${field.question ?? ''} ${field.name ?? ''} ${field.label}`;
                if (/\b(?:gender|sex|state|province|country|salutation)\b/iu.test(identity)) continue;
                const key = fieldGroupKey(field);
                if (key) groups.set(key, [...(groups.get(key) ?? []), field]);
              }
              const probeDeadline = Date.now() + 8_000;
              // Later questions often gate the next section. Check them first
              // so earlier ordinary eligibility answers do not consume the
              // whole probe budget before a final routing choice is reached.
              for (const group of [...groups.values()].reverse().slice(0, 4)) {
                if (Date.now() >= probeDeadline) break;
                const beforeProbe = await extractVisibleFields(page);
                const beforeKeys = new Set(beforeProbe.map(fieldMemoryKey));
                const trials = group[0]?.tag === 'select'
                  ? (group[0].options ?? []).filter(option => option.value !== '').slice(0, 4)
                    .map(option => ({ field: group[0]!, value: option.value }))
                  : group.slice(0, 4).map(field => ({ field, value: 'true' }));
                for (const trial of trials) {
                  if (Date.now() >= probeDeadline) break;
                  try {
                    await fillFields(page, [trial.field], new Map([[trial.field.id, trial.value]]), { forceChoiceEvent: true });
                    const afterProbe = await waitForFieldChange(page, fieldSignature(beforeProbe),
                      Math.min(1_500, this.options.formReadyTimeoutMs));
                    if (!afterProbe || page.url() !== urlBeforeFill) continue;
                    discoveredGroup = group;
                    for (const field of afterProbe) {
                      if (isConditionalChoice(field) && !beforeKeys.has(fieldMemoryKey(field))) {
                        dependentChoiceKeys.add(fieldMemoryKey(field));
                      }
                    }
                    logRun(runId, 'CONDITIONAL_CHOICE_DISCOVERED', { step: stepNumber,
                      label: group[0]?.question ?? group[0]?.label, newFields: afterProbe.filter(field => !beforeKeys.has(fieldMemoryKey(field))).length });
                    break;
                  } catch {
                    // A site may replace a control during a probe. The normal
                    // form scan below will reacquire the active fields.
                  }
                }
                if (discoveredGroup) break;
              }
            }
            if (discoveredGroup) {
              for (const field of discoveredGroup) uploaded.delete(field.id);
              for (const field of discoveredGroup) discoveredChoiceKeys.add(fieldMemoryKey(field));
              humanFields.push(...discoveredGroup);
            } else {
              await fillFields(page, generalChoices, uploaded);
              // AEM can reveal a dependent field after the short prefill probe
              // has timed out. Detect that change before treating the AI's
              // choice as the user's answer.
              const afterAIFill = generalChoices.some(field => field.tag === 'select' || field.type === 'radio')
                ? await waitForFieldChange(page, fieldSignature(fields), 5_000) : undefined;
              const lateGroup = afterAIFill && page.url() === urlBeforeFill
                ? choiceBeforeNewFields(fields, afterAIFill, generalChoices) : undefined;
              if (lateGroup) {
                for (const field of lateGroup) uploaded.delete(field.id);
                for (const field of lateGroup) discoveredChoiceKeys.add(fieldMemoryKey(field));
                humanFields.push(...lateGroup);
                logRun(runId, 'CONDITIONAL_CHOICE_DISCOVERED', { step: stepNumber,
                  label: lateGroup[0]?.question ?? lateGroup[0]?.label, delayed: true });
              }
            }
          }
          if (humanFields.length) {
            humanPromptedThisAttempt = true;
            const input = await this.stepInput.wait(runId, humanFields, stepNumber, page.url(), timeout, expiresAt,
              correcting ? message
                : 'AI filled the general fields. Choose the flow options and enter any requested verification details.',
              stepToken, { kind: 'human-fields' });
            manualChoiceSubmitted = humanFields.some(field => field.tag === 'select' || ['radio', 'checkbox'].includes(field.type));
            for (const item of input.values) uploaded.set(item.fieldId, item.value);
          }
        } else {
          const input = await this.stepInput.wait(runId, requested, stepNumber, page.url(), timeout, expiresAt, message, stepToken,
            { initialValues: known });
          uploaded = input.useAI
            ? await this.generateValidatedValues(runId, record.request.scenario, requested, `step-${stepNumber}`, input.values)
            : new Map(input.values.map(item => [item.fieldId, item.value]));
        }
        for (const field of requested) {
          const value = uploaded.get(field.id);
          if (value !== undefined) {
            const canonical = field.tag === 'select'
              ? field.options?.find(option => option.value === value || option.label === value)?.value ?? value : value;
            memory.set(fieldMemoryKey(field), canonical);
            uploaded.set(field.id, canonical);
          }
        }
        const currentFields = await extractVisibleFields(page);
        if (await workflowStateSignature(page, currentFields) !== signature) {
          if (page.url() !== urlBeforeFill) {
            await this.finishExcelStep(runId, stepNumber, 'page:auto-advanced');
            memory.clear();
            dependentChoiceKeys.clear();
            discoveredChoiceKeys.clear();
            stepNumber += 1;
          }
          stepToken = randomUUID();
          correcting = false;
          message = aiGuided
            ? 'The form changed while you were editing. Existing answers are retained for this page; enter any new requested values.'
            : 'The form changed while you were editing. Existing answers are retained for this page; download the Excel for the remaining fields.';
          continue;
        }
      }
      correcting = false;
      const revealedFields = await this.fillRememberedFields(page, fields, memory, signature, uploaded, manualChoiceSubmitted);
      const changed = revealedFields ?? await waitForFieldChange(page, fieldSignature(fields), Math.min(5_000, this.options.formReadyTimeoutMs));
      if (changed || page.url() !== urlBeforeFill) {
        if (aiGuided && manualChoiceSubmitted && changed && page.url() === urlBeforeFill) {
          const before = new Set(fields.map(fieldMemoryKey));
          for (const field of changed) {
            if (isConditionalChoice(field) && !before.has(fieldMemoryKey(field))) {
              dependentChoiceKeys.add(fieldMemoryKey(field));
            }
          }
        }
        if (page.url() !== urlBeforeFill) {
          await this.finishExcelStep(runId, stepNumber, 'selection:auto-advanced');
          stepNumber += 1;
          memory.clear();
          dependentChoiceKeys.clear();
          discoveredChoiceKeys.clear();
        }
        stepToken = randomUUID();
        message = aiGuided
          ? 'Additional fields appeared on this page. Your previous answers are retained. Enter the new requested values.'
          : 'Additional fields appeared on this page. Your previous answers are retained. Fill only the new fields in this Excel.';
        continue;
      }
      let actions = await discoverFormActions(page, fields);
      let action = actions[0];
      let authorizedSelectedAction = false;
      if (actions.length > 1 || (action?.kind === 'submit' && !record.request.submit)) {
        const choice = await this.stepInput.wait(runId, [], stepNumber, page.url(), timeout, expiresAt,
          actions.length > 1
            ? 'Your answers are filled. These buttons lead to different flows. Choose how to continue.'
            : 'Your answers are filled. Choose the action to continue.', randomUUID(),
          { kind: 'action', actions: actions.map(({ id, label, kind }) => ({ id, label, kind })),
            requireSubmitAuthorization: !record.request.submit });
        const updated = await extractVisibleFields(page);
        if (await workflowStateSignature(page, updated) !== signature) {
          if (page.url() !== urlBeforeFill) {
            await this.finishExcelStep(runId, stepNumber, 'page:auto-advanced');
            memory.clear();
            dependentChoiceKeys.clear();
            discoveredChoiceKeys.clear();
            stepNumber += 1;
          }
          stepToken = randomUUID();
          message = 'The form changed before the action. Review the newly available fields.';
          continue;
        }
        const selected = actions.find(candidate => candidate.id === choice.actionId);
        actions = await discoverFormActions(page, updated);
        action = actions.find(candidate => candidate.id === choice.actionId && candidate.label === selected?.label && candidate.kind === selected.kind);
        if (!action && selected) {
          const matching = actions.filter(candidate => candidate.label === selected.label && candidate.kind === selected.kind);
          if (matching.length === 1) action = matching[0];
        }
        if (!action) { message = 'The selected action changed. Choose an available action again.'; continue; }
        authorizedSelectedAction = choice.authorizeSubmit === true && action.kind === 'submit';
      }
      const filled = await this.capture(page, runId, `${stepNumber}-${attempt}-filled`, `step-${stepNumber}-filled`);
      if (!action) {
        message = aiGuided
          ? 'The form did not show a Continue or Submit action. Review the screenshot and correct the requested values if needed.'
          : 'The form did not show a Continue or Submit action. Review the screenshot, correct the Excel if needed, and upload again.';
        correcting = true;
        continue;
      }
      if (action.kind === 'submit' && !record.request.submit && !authorizedSelectedAction) {
        await this.finishExcelStep(runId, stepNumber, 'submit-not-authorized');
        await this.store.update(runId, { status: 'inconclusive', completedAt: new Date().toISOString(),
          error: { code: 'submit_not_authorized', message: `The form is filled. "${action.label}" requires submission. Start a new run with submission enabled to follow this flow.` } });
        return;
      }
      const captcha = await this.inspectCaptcha(page, runId);
      if (captcha.detected && captcha.blocking) {
        await this.completeCaptchaBlocked(page, runId, stepNumber, filled.url);
        return;
      }
      const previousUrl = page.url();
      logRun(runId, 'FORM_ACTION_SELECTED', { step: stepNumber, kind: action.kind, label: action.label });
      await this.store.update(runId, { steps: this.requireRun(runId).steps.map(step => step.number === stepNumber
        ? { ...step, action: `${action.kind}:${action.label}`,
          ...(action.kind === 'submit' ? { submissionAuthorized: record.request.submit || authorizedSelectedAction } : {}) } : step) });
      const observed = await captureActionNetwork(page, stepNumber, `${action.kind}:${action.label}`, async () => {
        await action.locator.click();
        await page.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => undefined);
        return waitForPostAction(page, signature, action.kind === 'submit' ? previousUrl : '',
          record.request.expectedOutcome, this.options.formReadyTimeoutMs,
          this.options.initialFormReadyTimeoutMs ?? this.options.formReadyTimeoutMs);
      });
      const transition = observed.result;
      await this.recordNetworkDiagnostics(runId, observed.diagnostics);
      // Guided runs require a confirmation or a new form; a redirect alone does not finish the run.
      if (transition.outcome.matched) { await this.finishExcelStep(runId, stepNumber, action.kind); await this.completePassed(page, runId, transition.outcome); return; }
      if (transition.fields.length && (await workflowStateSignature(page, transition.fields) !== signature || page.url() !== previousUrl)) {
        await this.finishExcelStep(runId, stepNumber, action.kind);
        stepNumber += 1;
        memory.clear();
        dependentChoiceKeys.clear();
        discoveredChoiceKeys.clear();
        stepToken = randomUUID();
        message = aiGuided
          ? 'The next page is ready. AI will fill general fields and ask for any choices or verification values.'
          : 'The next page is ready. Download its Excel, fill it, then upload.';
        continue;
      }
      if (!transition.fields.length) {
        await this.store.update(runId, { status: 'inconclusive', completedAt: new Date().toISOString(),
          error: { code: 'no_form_or_confirmation', message: 'The destination has no editable fields or detectable confirmation.' } });
        return;
      }
      const siteErrors = await readFormErrors(page);
      const failedRequests = failedSiteRequests(observed.diagnostics, record.request.url);
      const afterClick = await this.capture(page, runId, `${stepNumber}-${attempt}-after-action`, `step-${stepNumber}-after-action`);
      await this.store.update(runId, { steps: this.requireRun(runId).steps.map(step => step.number === stepNumber
        ? { ...step, screenshot: afterClick.url } : step) });
      message = `After clicking "${action.label}", the form stayed on this page. ${siteErrors.length || failedRequests.length
        ? `The site reported: ${[...siteErrors, ...failedRequests].join(' | ')}. `
        : 'No next form or confirmation was detected. Check the screenshot for feedback from the site. '}` +
        (aiGuided
          ? 'Your answers are retained. Review the requested values and try again.'
          : 'Your answers are retained. Download the prefilled Excel if you need to correct values, or upload it again when ready to retry.');
      if (aiGuided) {
        unattendedRejections = humanPromptedThisAttempt ? 0 : unattendedRejections + 1;
        if (unattendedRejections >= 2) {
          await this.store.update(runId, { status: 'inconclusive', completedAt: new Date().toISOString(),
            error: { code: 'site_rejected_submission', message } });
          return;
        }
      }
      correcting = true;
    }
    throw new Error('The form exceeded the configured maximum number of steps.');
  }

  private async fillRememberedFields(page: Page, fields: FormField[], memory: Map<string, string>, signature: string,
    uploaded = new Map<string, string>(), forceChoiceEvent = false): Promise<FormField[] | undefined> {
    // Fresh workbook IDs are valid until the next rerender, even for controls
    // whose names/labels are too ambiguous to retain safely across rerenders.
    const values = new Map([...retainedValues(editableFields(fields), memory), ...uploaded]);
    const priority = (field: FormField) => ['checkbox', 'radio'].includes(field.type) ? 2 : field.tag === 'select' ? 1 : 0;
    const ordered = editableFields(fields).sort((left, right) => priority(left) - priority(right));
    try {
      for (const field of ordered) {
        const value = values.get(field.id);
        if (value === undefined || (field.tag === 'select' && !field.required && value === '')) continue;
        const selectedChoice = uploaded.has(field.id) && (field.tag === 'select' || field.type === 'checkbox' ||
          (field.type === 'radio' && value === 'true'));
        if (await readFieldValue(page, field) !== value || (forceChoiceEvent && selectedChoice)) {
          await fillFields(page, [field], new Map([[field.id, value]]),
            { settleAfterEachFieldMs: 5_000, forceChoiceEvent: forceChoiceEvent && selectedChoice });
          const updated = await extractVisibleFields(page);
          if (await workflowStateSignature(page, updated) !== signature) return updated;
        }
      }
    } catch (error) {
      const updated = await waitForStableFormFields(page, { timeoutMs: this.options.formReadyTimeoutMs, minimumWaitMs: 500 });
      if (await workflowStateSignature(page, updated) === signature) throw error;
      return updated;
    }
    return undefined;
  }

  private async finishExcelStep(runId: string, number: number, action: string): Promise<void> {
    await this.store.update(runId, { steps: this.requireRun(runId).steps.map(step => step.number === number
      ? { ...step, status: 'completed', action } : step) });
  }

  private async recordNetworkDiagnostics(runId: string, diagnostics: RunRecord['networkDiagnostics']): Promise<void> {
    if (!diagnostics?.length) return;
    const current = this.requireRun(runId);
    await this.store.update(runId, {
      networkDiagnostics: [...(current.networkDiagnostics ?? []), ...diagnostics].slice(-100)
    });
    for (const diagnostic of diagnostics) {
      logRun(runId, 'ACTION_NETWORK', diagnostic);
    }
  }

  private async captureInitialChoiceBranches(page: Page, runId: string, timeout: AbortSignal): Promise<boolean> {
    const record = this.requireRun(runId);
    const initialFields = await extractVisibleFields(page);
    if (!discoverBranchGroup(initialFields, [], record.request.payload)) return false;

    const maximumPaths = 128;
    // A stack gives depth-first traversal: condition 1 Yes (all steps), then
    // condition 1 No (all steps), then condition 2, and so on.
    const pendingPaths: BranchChoice[][] = [[]];
    const visitedPaths = new Set<string>();
    const pathRetryCounts = new Map<string, number>();
    let processedPaths = 0;
    let capturedLeaves = 0;
    let discoveredChoices = 0;
    let truncated = false;

    while (pendingPaths.length > 0) {
      if (timeout.aborted) throw new Error('Run timed out while traversing form branches.');
      if (processedPaths >= maximumPaths) {
        truncated = true;
        logRun(runId, 'BRANCH_LIMIT_REACHED', { maximumPaths, remainingPaths: pendingPaths.length });
        break;
      }
      const path = pendingPaths.pop()!;
      const pathKey = path.map(choice => `${choice.groupKey}=${choice.value}`).join('|') || 'root';
      if (visitedPaths.has(pathKey)) continue;
      visitedPaths.add(pathKey);
      processedPaths += 1;

      // The root state is already loaded and stable when traversal starts.
      // Every non-root path receives a fresh navigation before its choices
      // are replayed.
      let currentFields = initialFields;
      if (path.length > 0) {
        try {
          await this.navigateWithRetry(page, record.request.url, runId);
          await waitForStableFormFields(page, { timeoutMs: this.options.formReadyTimeoutMs });
          const scenarioBranch = await selectScenarioBranch(page, record.request.scenario);
          if (scenarioBranch) {
            await waitForStableFormFields(page, {
              timeoutMs: this.options.formReadyTimeoutMs,
              minimumWaitMs: 500
            });
          }
          currentFields = await extractVisibleFields(page);
          currentFields = await this.restoreBranchRoot(
            page,
            record.request.url,
            path[0]!.groupKey,
            currentFields,
            runId
          );
        } catch (error) {
          truncated = true;
          logRun(runId, 'BRANCH_NAVIGATION_FAILED', {
            path: branchPathLabel(path),
            message: error instanceof Error ? error.message : String(error)
          });
          continue;
        }
      }
      let replayFailed = false;
      for (let depth = 0; depth < path.length; depth += 1) {
        if (timeout.aborted) throw new Error('Run timed out while replaying a form branch.');
        const choice = path[depth]!;
        let groupFields = fieldsForBranchChoice(currentFields, choice);
        if (groupFields.length === 0) {
          // AEM can replace the iframe and render a Yes/No gate several
          // seconds after the preceding condition selection. Reacquire the
          // exact current choice at every replay depth before failing.
          const recoveredFields = await this.waitForExpectedBranchGroup(
            page,
            choice,
            this.options.formReadyTimeoutMs
          );
          if (recoveredFields) {
            currentFields = recoveredFields;
            groupFields = fieldsForBranchChoice(currentFields, choice);
            logRun(runId, 'BRANCH_CONTROL_REACQUIRED', {
              depth: depth + 1,
              path: branchPathLabel(path),
              label: choice.label,
              fieldCount: groupFields.length
            });
          }
        }
        if (groupFields.length === 0) {
          replayFailed = true;
          logRun(runId, 'BRANCH_REPLAY_FAILED', {
            depth: depth + 1,
            path: branchPathLabel(path),
            label: choice.label,
            expectedGroup: choice.groupKey,
            availableGroups: [...new Set(currentFields.map(fieldGroupKey).filter(Boolean))],
            fields: fieldLogDetails(currentFields),
            message: 'The expected branch control was not visible after replay.'
          });
          break;
        }
        const previousState = await workflowStateSignature(page, currentFields);
        await this.applyBranchChoice(page, groupFields, choice);
        logRun(runId, 'BRANCH_REPLAYED', {
          depth: depth + 1,
          path: branchPathLabel(path),
          kind: choice.kind,
          label: choice.label
        });
        const nextChoice = path[depth + 1];
        if (nextChoice) {
          const expectedFields = await this.waitForExpectedBranchGroup(
            page,
            nextChoice,
            this.options.formReadyTimeoutMs
          );
          currentFields = expectedFields ?? await waitForWorkflowStateChange(
            page,
            previousState,
            Math.min(2_000, this.options.formReadyTimeoutMs)
          );
        } else {
          currentFields = await waitForWorkflowStateChange(
            page,
            previousState,
            this.options.formReadyTimeoutMs
          );
        }
      }
      if (replayFailed) continue;

      const nextGroup = discoverBranchGroup(currentFields, path, record.request.payload);
      if (nextGroup && path.length < record.request.maxSteps) {
        discoveredChoices += nextGroup.options.length;
        logRun(runId, 'BRANCHES_DISCOVERED', {
          depth: path.length + 1,
          path: branchPathLabel(path) || 'root',
          kind: nextGroup.kind,
          label: nextGroup.label,
          count: nextGroup.options.length,
          labels: nextGroup.options.map(option => option.label)
        });
        // Push in reverse so the first visual option (normally Yes) is popped
        // and completed before the second option (normally No).
        for (const option of [...nextGroup.options].reverse()) {
          pendingPaths.push([...path, {
            kind: nextGroup.kind,
            groupKey: nextGroup.groupKey,
            label: option.label,
            value: option.value
          }]);
        }
        continue;
      }

      if (nextGroup) {
        truncated = true;
        logRun(runId, 'BRANCH_DEPTH_LIMIT_REACHED', {
          depth: path.length,
          path: branchPathLabel(path),
          maxDepth: record.request.maxSteps
        });
        continue;
      }

      const leafNumber = capturedLeaves + 1;
      try {
        await this.captureBranchLeaf(page, runId, path, currentFields, leafNumber);
        capturedLeaves += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (error instanceof BranchLeafNotReadyError) {
          const retryCount = pathRetryCounts.get(pathKey) ?? 0;
          if (retryCount < 1) {
            pathRetryCounts.set(pathKey, retryCount + 1);
            visitedPaths.delete(pathKey);
            pendingPaths.push(path);
            logRun(runId, 'BRANCH_PATH_RETRY_SCHEDULED', {
              depth: path.length,
              path: branchPathLabel(path),
              attempt: retryCount + 2,
              message: 'No conditional controls rendered; reloading and replaying this path once.'
            });
            continue;
          }
          truncated = true;
          logRun(runId, 'BRANCH_PATH_SKIPPED', {
            depth: path.length,
            path: branchPathLabel(path),
            attempt: retryCount + 1,
            message: 'No conditional form rendered after a fresh replay; no screenshot was captured.'
          });
          continue;
        }
        truncated = true;
        logRun(runId, 'BRANCH_LEAF_FAILED', {
          leaf: leafNumber,
          depth: path.length,
          path: branchPathLabel(path),
          message
        });
      }
    }

    await this.store.update(runId, {
      status: 'inconclusive',
      completedAt: new Date().toISOString(),
      error: {
        code: 'choice_branches_captured',
        message: (truncated
          ? `Captured ${capturedLeaves} leaf forms before reaching a branch traversal limit.`
          : `Captured ${capturedLeaves} leaf forms across ${discoveredChoices} discovered choices.`) +
          (record.request.submit && !(this.requireRun(runId).branchOutcomes ?? []).some(outcome => outcome.matched)
            ? ' No confirmation page was captured.'
            : '')
      }
    });
    return true;
  }

  private async applyBranchChoice(page: Page, groupFields: FormField[], choice: BranchChoice): Promise<void> {
    const selectionValues = new Map<string, string>();
    if (choice.kind === 'select') {
      const select = groupFields.find(field => field.tag === 'select');
      if (!select) throw new Error(`Unable to replay select branch ${choice.label}.`);
      selectionValues.set(select.id, choice.value);
    } else {
      for (const field of groupFields) {
        selectionValues.set(
          field.id,
          field.label.trim().toLowerCase() === choice.label.trim().toLowerCase() ? 'true' : 'false'
        );
      }
    }
    await fillFields(page, groupFields, selectionValues, {
      forceChoiceEvent: true,
      settleAfterEachFieldMs: 5_000
    });
  }

  private async waitForExpectedBranchGroup(
    page: Page,
    expectedChoice: BranchChoice,
    timeoutMs: number
  ): Promise<FormField[] | undefined> {
    const startedAt = Date.now();
    let previousSignature = '';
    let stablePolls = 0;
    while (Date.now() - startedAt < timeoutMs) {
      const candidates = await extractVisibleFieldCandidates(page);
      const matchingCandidate = candidates.find(fields =>
        fieldsForBranchChoice(fields, expectedChoice).length > 0
      );
      if (matchingCandidate) {
        const signature = fieldSignature(matchingCandidate);
        stablePolls = signature === previousSignature ? stablePolls + 1 : 0;
        previousSignature = signature;
        if (stablePolls >= 2) return matchingCandidate;
      } else {
        previousSignature = '';
        stablePolls = 0;
      }
      await page.waitForTimeout(250);
    }
    return undefined;
  }

  private async restoreBranchRoot(
    page: Page,
    originalUrl: string,
    expectedGroupKey: string,
    initialFields: FormField[],
    runId: string
  ): Promise<FormField[]> {
    if (initialFields.some(field => fieldGroupKey(field) === expectedGroupKey)) return initialFields;

    // RINVOQ remembers the selected condition across a normal reload and
    // exposes a button that restores the initial condition selector.
    for (const frame of page.frames()) {
      const resetActions = [
        frame.getByRole('button', { name: /select a different|choose a different|change (?:your )?condition|change selection|start over/iu }),
        frame.getByRole('link', { name: /select a different|choose a different|change (?:your )?condition|change selection|start over/iu })
      ];
      for (const locator of resetActions) {
        const count = await locator.count().catch(() => 0);
        for (let index = 0; index < count; index += 1) {
          const action = locator.nth(index);
          if (!await action.isVisible().catch(() => false)) continue;
          await action.click();
          const restored = await waitForStableFormFields(page, {
            timeoutMs: this.options.formReadyTimeoutMs,
            minimumWaitMs: 500
          });
          if (restored.some(field => fieldGroupKey(field) === expectedGroupKey)) {
            logRun(runId, 'BRANCH_ROOT_RESET', { method: 'page-action', label: await action.innerText().catch(() => '') });
            return restored;
          }
        }
      }
    }

    // Generic fallback for sites that persist a form branch without exposing
    // a reset action. This context belongs only to the current screenshot run.
    await Promise.all(page.frames().map(frame => frame.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    }).catch(() => undefined)));
    await page.context().clearCookies();
    await this.navigateWithRetry(page, originalUrl, runId);
    const restored = await waitForStableFormFields(page, {
      timeoutMs: this.options.formReadyTimeoutMs,
      minimumWaitMs: 500
    });
    logRun(runId, 'BRANCH_ROOT_RESET', {
      method: 'isolated-storage-reset',
      restored: restored.some(field => fieldGroupKey(field) === expectedGroupKey)
    });
    return restored;
  }

  private async captureBranchLeaf(
    page: Page,
    runId: string,
    path: BranchChoice[],
    initialFields: FormField[],
    leafNumber: number
  ): Promise<void> {
    const record = this.requireRun(runId);
    const answeredGroups = new Set(path.map(choice => choice.groupKey));
    const pathLabel = branchPathLabel(path);
    const artifactPath = branchPathArtifactName(path);
    const seenSignatures = new Set<string>();
    let currentFields = initialFields;

    for (let localStep = 1; localStep <= record.request.maxSteps; localStep += 1) {
      const fieldsToFill = currentFields.filter(field => {
        const groupKey = fieldGroupKey(field);
        return !groupKey || !answeredGroups.has(groupKey);
      });
      if (fieldsToFill.length === 0) {
        throw new BranchLeafNotReadyError(pathLabel || 'root');
      }

      const signature = `${page.url()}::${pathLabel}::${fieldSignature(fieldsToFill)}`;
      if (seenSignatures.has(signature)) return;
      logRun(runId, 'BRANCH_LEAF_DISCOVERED', {
        branch: leafNumber,
        branchLabel: pathLabel,
        step: localStep,
        fieldCount: fieldsToFill.length,
        fields: fieldLogDetails(fieldsToFill)
      });

      const stepNumber = this.requireRun(runId).steps.length + 1;
      const beforeStep = this.requireRun(runId);
      await this.store.update(runId, {
        currentStep: stepNumber,
        steps: [...beforeStep.steps, { number: stepNumber, status: 'started', fieldCount: fieldsToFill.length }]
      });

      const values = await this.generateValidatedValues(
        runId,
        record.request.scenario,
        fieldsToFill,
        `branch:${pathLabel}:step-${localStep}`
      );
      try {
        await fillFields(page, fieldsToFill, values, { settleAfterEachFieldMs: 5_000 });
      } catch (error) {
        const latest = this.requireRun(runId);
        if (isTransientFormStateError(error)) {
          await this.store.update(runId, {
            steps: latest.steps.map(item => item.number === stepNumber
              ? {
                  ...item,
                  status: 'completed',
                  action: `branch:${pathLabel}:form-rerendered`
                }
              : item)
          });
          logRun(runId, 'BRANCH_FORM_RERENDERED_DURING_FILL', {
            branch: leafNumber,
            branchLabel: pathLabel,
            step: localStep,
            message: error instanceof Error ? error.message : String(error)
          });
          currentFields = await waitForStableFormFields(page, {
            timeoutMs: this.options.formReadyTimeoutMs,
            minimumWaitMs: 5_000
          });
          continue;
        }
        await this.store.update(runId, {
          steps: latest.steps.map(item => item.number === stepNumber
            ? { ...item, status: 'failed' }
            : item)
        });
        throw error;
      }
      seenSignatures.add(signature);
      logRun(runId, 'BRANCH_LEAF_FILLED', {
        branch: leafNumber,
        branchLabel: pathLabel,
        step: localStep,
        fieldCount: fieldsToFill.length
      });

      // Full-page screenshots previously supplied an accidental render delay.
      // Keep the reduced artifact policy, but explicitly wait for conditional
      // AEM controls revealed by the newly filled select/radio/checkbox data.
      const renderedFields = await waitForFieldChange(
        page,
        fieldSignature(currentFields),
        Math.min(5_000, this.options.formReadyTimeoutMs)
      );
      if (renderedFields) {
        currentFields = renderedFields;
        const latest = this.requireRun(runId);
        await this.store.update(runId, {
          steps: latest.steps.map(item => item.number === stepNumber
            ? {
                ...item,
                status: 'completed',
                action: `branch:${pathLabel}:selection:auto-advanced`
              }
            : item)
        });
        logRun(runId, 'BRANCH_DYNAMIC_FIELDS_RENDERED', {
          branch: leafNumber,
          branchLabel: pathLabel,
          step: localStep,
          fieldCount: renderedFields.length
        });
        continue;
      }
      // Keep the fully filled state in memory before an action can replace
      // the AEM branch. It is persisted only if this proves to be the final
      // action, so intermediate Next steps do not add PDF pages.
      const deferredFilledImage = await this.captureBuffer(page, runId);
      const action = await findFormAction(page, currentFields);
      logRun(runId, 'BRANCH_ACTION_DISCOVERED', {
        branch: leafNumber,
        branchLabel: pathLabel,
        step: localStep,
        kind: action.kind,
        label: action.label ?? null
      });
      // Only capture a filled form at its final submit/no-action state. Next
      // buttons and conditional transitions remain visible in logs but do not
      // create intermediate screenshots or PDF pages.
      let filledArtifact = (
        !action.locator || action.kind === 'none' || action.kind === 'submit'
      ) ? await this.persistCapture(
          runId,
          `leaf-${String(leafNumber).padStart(3, '0')}-${artifactPath}-${localStep}-filled`,
          `branch:${pathLabel}:final-filled`,
          deferredFilledImage,
          page.url()
        ) : undefined;

      if (!action.locator || action.kind === 'none' || (action.kind === 'submit' && !record.request.submit)) {
        const latest = this.requireRun(runId);
        await this.store.update(runId, {
          steps: latest.steps.map(item => item.number === stepNumber
            ? {
                ...item,
                status: 'completed',
                action: action.kind === 'submit'
                  ? `branch:${pathLabel}:submit-not-authorized`
                  : `branch:${pathLabel}:filled`,
                screenshot: filledArtifact?.url
              }
            : item)
        });
        return;
      }

      const captcha = await this.inspectCaptcha(page, runId);
      if (action.kind === 'submit' && captcha.detected && captcha.blocking) {
        await this.completeCaptchaBlocked(page, runId, stepNumber, filledArtifact?.url ?? '');
        return;
      }

      const stateBeforeAction = await workflowStateSignature(page, currentFields);
      const urlBeforeAction = page.url();
      const confirmationUrlBeforeAction = action.kind === 'submit' ? urlBeforeAction : undefined;
      const transitionStartedAt = Date.now();
      logRun(runId, 'BRANCH_STATE_TRANSITION_WAIT_STARTED', {
        branch: leafNumber,
        branchLabel: pathLabel,
        step: localStep,
        kind: action.kind,
        timeoutMs: this.options.formReadyTimeoutMs,
        url: page.url()
      });
      const observed = await captureActionNetwork(page, stepNumber, `branch:${pathLabel}:${action.kind}:${action.label ?? ''}`, async () => {
        await action.locator!.click();
        await page.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => undefined);
        return waitForPostAction(
          page,
          stateBeforeAction,
          confirmationUrlBeforeAction ?? '',
          record.request.expectedOutcome,
          this.options.formReadyTimeoutMs,
          this.options.initialFormReadyTimeoutMs ?? this.options.formReadyTimeoutMs
        );
      });
      const transition = observed.result;
      await this.recordNetworkDiagnostics(runId, observed.diagnostics);
      currentFields = transition.fields;
      logRun(runId, 'BRANCH_STATE_TRANSITION_COMPLETED', {
        branch: leafNumber,
        branchLabel: pathLabel,
        step: localStep,
        url: page.url(),
        frameCount: page.frames().length,
        durationMs: Date.now() - transitionStartedAt,
        destinationHasForm: currentFields.length > 0,
        outcomeType: transition.outcome.type ?? null
      });
      if (
        action.kind === 'submit' &&
        currentFields.length > 0 &&
        await workflowStateSignature(page, currentFields) === stateBeforeAction
      ) {
        const captchaAfterSubmit = await this.inspectCaptcha(page, runId);
        if (captchaAfterSubmit.blocking) {
          await this.completeCaptchaBlocked(page, runId, stepNumber, filledArtifact?.url ?? '', true);
          return;
        }
      }
      if (currentFields.length === 0 && !filledArtifact) {
        filledArtifact = await this.persistCapture(
          runId,
          `leaf-${String(leafNumber).padStart(3, '0')}-${artifactPath}-${localStep}-filled`,
          `branch:${pathLabel}:final-filled`,
          deferredFilledImage,
          urlBeforeAction
        );
        logRun(runId, 'BRANCH_TERMINAL_NEXT_CAPTURED', {
          branch: leafNumber,
          branchLabel: pathLabel,
          step: localStep,
          kind: action.kind
        });
      }
      // A newly discovered form is filled by the next loop iteration. Capture
      // only destinations without form fields (thank-you/result/error pages).
      const destinationArtifact = currentFields.length === 0
        ? await this.capture(
            page,
            runId,
            `leaf-${String(leafNumber).padStart(3, '0')}-${artifactPath}-destination`,
            `branch:${pathLabel}:destination`
          )
        : undefined;
      const latest = this.requireRun(runId);
      await this.store.update(runId, {
        steps: latest.steps.map(item => item.number === stepNumber
          ? {
              ...item,
              status: 'completed',
              action: `branch:${pathLabel}:${action.kind}:${action.label ?? ''}`,
              ...(filledArtifact ? { screenshot: filledArtifact.url } : {})
            }
          : item)
      });
      if ((action.kind === 'submit' || action.kind === 'next') && currentFields.length === 0) {
        if (transition.outcome.matched) {
          const current = this.requireRun(runId);
          await this.store.update(runId, {
            branchOutcomes: [
              ...(current.branchOutcomes ?? []),
              {
                path: pathLabel,
                matched: true,
                ...(transition.outcome.type ? { type: transition.outcome.type } : {}),
                ...(transition.outcome.value ? { value: transition.outcome.value } : {}),
                ...(destinationArtifact ? { screenshot: destinationArtifact.url } : {})
              }
            ]
          });
        } else {
          const current = this.requireRun(runId);
          await this.store.update(runId, {
            branchOutcomes: [
              ...(current.branchOutcomes ?? []),
              {
                path: pathLabel,
                matched: false,
                ...(destinationArtifact ? { screenshot: destinationArtifact.url } : {})
              }
            ],
            ...(action.kind === 'submit'
              ? {
                  error: {
                    code: 'post_submit_confirmation_not_found',
                    message: `Branch ${pathLabel} submitted without a detectable confirmation.`
                  }
                }
              : {})
          });
        }
        return;
      }
    }
  }

  private async generateValidatedValues(
    runId: string,
    scenario: string,
    fields: FormField[],
    scope: string,
    suppliedValues?: GeneratedValue[]
  ): Promise<Map<string, string>> {
    const supplied = suppliedValues ?? resolvePayloadValues(fields, this.requireRun(runId).request.payload);
    const suppliedIds = new Set(supplied.map(item => item.fieldId));
    const generationFields = fields.filter(field => !suppliedIds.has(field.id));
    const merge = (generated: Array<{ fieldId: string; value: string }>) => [
      ...generated.filter(item => !suppliedIds.has(item.fieldId)), ...supplied
    ];
    if (!generationFields.some(field => !field.disabled && !field.readOnly &&
      !['hidden', 'submit', 'button', 'file'].includes(field.type))) {
      return validateGeneratedValues(fields, supplied).values;
    }
    const generationStartedAt = Date.now();
    logRun(runId, 'DATA_GENERATION_STARTED', {
      scope,
      provider: this.generator.provider,
      model: this.generator.model ?? null,
      fieldCount: fields.length
    });
    let validationErrors: string[] = [];
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      await this.incrementGenerationMetrics(runId, { requests: 1 });
      try {
        const generated = await this.generator.generate({
          scenario,
          fields: generationFields,
          ...(validationErrors.length > 0 ? { validationErrors } : {})
        });
        const conformed = conformGeneratedValues(generationFields, generated);
        if (conformed.changedCount > 0) {
          logRun(runId, 'DATA_CONSTRAINTS_NORMALIZED', {
            scope,
            provider: this.generator.provider,
            attempt,
            fieldCount: conformed.changedCount
          });
        }
        const validation = validateGeneratedValues(fields, merge(conformed.values));
        if (validation.errors.length === 0) {
          logRun(runId, 'DATA_GENERATED', {
            scope,
            provider: this.generator.provider,
            model: this.generator.model ?? null,
            attempt,
            fieldCount: fields.length,
            durationMs: Date.now() - generationStartedAt
          });
          return validation.values;
        }
        validationErrors = validation.errors;
        logRun(runId, 'DATA_VALIDATION_FAILED', {
          scope,
          provider: this.generator.provider,
          attempt,
          errorCount: validation.errors.length,
          errors: validation.errors
        });
        if (attempt === 1) await this.incrementGenerationMetrics(runId, { validationRetries: 1 });
      } catch (error) {
        validationErrors = [error instanceof Error ? error.message : String(error)];
        logRun(runId, 'DATA_GENERATION_FAILED', {
          scope,
          provider: this.generator.provider,
          attempt,
          message: validationErrors[0]
        });
        break;
      }
    }

    if (this.generator.provider !== 'local') {
      const fallback = await this.fallbackGenerator.generate({ fields: generationFields });
      const conformedFallback = conformGeneratedValues(generationFields, fallback);
      const validation = validateGeneratedValues(fields, merge(conformedFallback.values));
      if (validation.errors.length === 0) {
        await this.incrementGenerationMetrics(runId, { fallbackCount: 1 });
        logRun(runId, 'DATA_GENERATION_FALLBACK', {
          scope,
          provider: this.generator.provider,
          fallbackProvider: 'local',
          reasonCount: validationErrors.length,
          fieldCount: fields.length,
          durationMs: Date.now() - generationStartedAt
        });
        return validation.values;
      }
      validationErrors = [...validationErrors, ...validation.errors];
    }

    throw new Error(`Generated data was invalid for ${scope}: ${validationErrors.join('; ')}`);
  }

  private async incrementGenerationMetrics(
    runId: string,
    increment: Partial<Pick<NonNullable<RunRecord['dataGeneration']>, 'requests' | 'validationRetries' | 'fallbackCount'>>
  ): Promise<void> {
    const current = this.requireRun(runId);
    const existing = current.dataGeneration ?? {
      provider: this.generator.provider,
      ...(this.generator.model ? { model: this.generator.model } : {}),
      requests: 0,
      validationRetries: 0,
      fallbackCount: 0
    };
    await this.store.update(runId, {
      dataGeneration: {
        ...existing,
        requests: existing.requests + (increment.requests ?? 0),
        validationRetries: existing.validationRetries + (increment.validationRetries ?? 0),
        fallbackCount: existing.fallbackCount + (increment.fallbackCount ?? 0)
      }
    });
  }

  private async inspectCaptcha(page: Page, runId: string) {
    const captcha = await detectCaptcha(page);
    if (!captcha.detected) return captcha;

    const current = this.requireRun(runId);
    const changed = !current.captcha.detected || current.captcha.blocking !== captcha.blocking;
    await this.store.update(runId, {
      captcha: {
        detected: true,
        ...(captcha.provider ? { provider: captcha.provider } : {}),
        ...(captcha.blocking !== undefined ? { blocking: captcha.blocking } : {}),
        action: current.captcha.action ?? 'observed'
      }
    });
    if (changed) {
      logRun(runId, 'CAPTCHA_DETECTED', {
        provider: captcha.provider ?? 'unknown',
        blocking: captcha.blocking ?? false
      });
    }
    return captcha;
  }

  private async completeCaptchaBlocked(
    page: Page,
    runId: string,
    stepNumber: number,
    filledScreenshot: string,
    submissionAttempted = false
  ): Promise<void> {
    const artifact = await this.capture(page, runId, `${stepNumber}-captcha`, 'captcha-detected');
    const current = this.requireRun(runId);
    await this.store.update(runId, {
      status: 'blocked',
      completedAt: new Date().toISOString(),
      captcha: {
        ...current.captcha,
        detected: true,
        blocking: true,
        action: submissionAttempted ? 'submission-blocked' : 'submission-skipped'
      },
      steps: current.steps.map(step => step.number === stepNumber
        ? {
            ...step,
            status: 'completed',
            action: submissionAttempted ? 'submit-blocked-captcha' : 'submit-skipped-captcha',
            screenshot: artifact.url ?? filledScreenshot
          }
        : step),
      error: {
        code: 'captcha_requires_human',
        message: submissionAttempted
          ? 'Submission could not advance because the CAPTCHA challenge or service was blocking it.'
          : 'A visible CAPTCHA challenge was detected. Submission was skipped and the filled form was captured.'
      }
    });
    logRun(runId, submissionAttempted ? 'CAPTCHA_SUBMISSION_BLOCKED' : 'CAPTCHA_SUBMISSION_SKIPPED', {
      step: stepNumber,
      provider: current.captcha.provider ?? 'unknown'
    });
  }

  private requireRun(id: string): RunRecord {
    const record = this.store.get(id);
    if (!record) throw new Error(`Run ${id} does not exist.`);
    return record;
  }

  private async navigateWithRetry(page: Page, url: string, runId?: string): Promise<void> {
    const maximumAttempts = 5;
    const retryDelays = [2_000, 5_000, 10_000, 20_000];
    for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
      try {
        // Give deferred scripts a chance to attach form event handlers before
        // inspecting controls. Visible HTML alone does not mean initialization
        // has finished. Field polling handles forms injected afterward.
        const response = await page.goto(url, { waitUntil: 'commit', timeout: 45_000 });
        const httpStatus = response?.status();
        if (httpStatus && httpStatus >= 400) {
          const retryable = [403, 408, 425, 429].includes(httpStatus) || httpStatus >= 500;
          const error = new Error(`Target returned HTTP ${httpStatus} for ${url}.`);
          if (!retryable || attempt === maximumAttempts) throw error;
          const delayMs = retryDelays[attempt - 1] ?? retryDelays.at(-1)!;
          if (runId) logRun(runId, 'NAVIGATION_RETRY', { attempt, httpStatus, delayMs, url });
          await page.waitForTimeout(delayMs);
          continue;
        }
        await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => undefined);
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/Target returned HTTP/iu.test(message)) throw error;
        const transient = /ERR_NETWORK_CHANGED|ERR_CONNECTION_RESET|ERR_TIMED_OUT|Navigation timeout|Timeout \d+ms exceeded|page\.goto/iu.test(message);
        if (!transient || attempt === maximumAttempts) throw error;
        const delayMs = retryDelays[attempt - 1] ?? retryDelays.at(-1)!;
        if (runId) logRun(runId, 'NAVIGATION_RETRY', { attempt, delayMs, message, url });
        await page.evaluate(() => window.stop()).catch(() => undefined);
        await page.waitForTimeout(delayMs);
      }
    }
  }

  private async installNetworkPolicy(page: Page): Promise<void> {
    await page.route('**/*', async route => {
      const request = route.request();
      const rawUrl = request.url();
      if (rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) {
        await route.continue();
        return;
      }
      try {
        await assertSafeUrl(rawUrl, {
          allowedHosts: this.options.allowedTargetHosts,
          allowPrivateNetworks: this.options.allowPrivateNetworks,
          requireAllowedHost: request.isNavigationRequest() && this.options.allowedTargetHosts.size > 0
        });
        await route.continue();
      } catch {
        await route.abort('blockedbyclient');
      }
    });
  }

  private async preparePageForCapture(page: Page, runId: string): Promise<void> {
    // Keep AbbVie floating safety bars in the DOM but hidden so they cannot
    // obscure form fields in screenshot-only evidence. Reapply before every
    // capture because site scripts may change the inline display value.
    const hiddenSafetyBars = await page.locator('.abbv-safety-bar').evaluateAll(elements => {
      elements.forEach(element => {
        (element as HTMLElement).style.setProperty('display', 'none', 'important');
        element.setAttribute('aria-hidden', 'true');
      });
      return elements.length;
    }).catch(() => 0);
    if (hiddenSafetyBars > 0) {
      logRun(runId, 'SAFETY_BAR_HIDDEN', { count: hiddenSafetyBars });
    }
    const hiddenCookieBanners = await page.locator('#onetrust-banner-sdk').evaluateAll(elements => {
      elements.forEach(element => {
        (element as HTMLElement).style.setProperty('display', 'none', 'important');
        element.setAttribute('aria-hidden', 'true');
      });
      return elements.length;
    }).catch(() => 0);
    if (hiddenCookieBanners > 0) {
      logRun(runId, 'COOKIE_BANNER_HIDDEN', { count: hiddenCookieBanners });
    }
    // Prevent AbbVie sticky headers from following the viewport and covering
    // form content in full-page screenshots. Reapply before every capture
    // because the site's sticky-header JavaScript may restore fixed/sticky.
    const absoluteHeaders = await page.locator('header.abbv-header-v2').evaluateAll(elements => {
      elements.forEach(element => {
        (element as HTMLElement).style.setProperty('position', 'absolute', 'important');
      });
      return elements.length;
    }).catch(() => 0);
    if (absoluteHeaders > 0) {
      logRun(runId, 'HEADER_POSITION_ABSOLUTE', { count: absoluteHeaders });
    }
  }

  private async captureBuffer(page: Page, runId: string, timeout = 15_000): Promise<Buffer> {
    await this.preparePageForCapture(page, runId);
    return page.screenshot({
      fullPage: true,
      type: 'png',
      timeout
    });
  }

  private async persistCapture(
    runId: string,
    name: string,
    stage: string,
    image: Buffer,
    sourceUrl: string
  ) {
    const fileName = `${name}.png`;
    await writeFile(this.store.artifactPath(runId, fileName), image);
    const artifact = {
      name: fileName,
      stage,
      url: `/v1/form-runs/${runId}/artifacts/${fileName}`,
      contentType: 'image/png' as const,
      createdAt: new Date().toISOString()
    };
    const current = this.requireRun(runId);
    await this.store.update(runId, { artifacts: [...current.artifacts, artifact] });
    logRun(runId, 'SCREENSHOT_CAPTURED', { name: fileName, stage, url: sourceUrl });
    return artifact;
  }

  private async capture(page: Page, runId: string, name: string, stage: string, timeout?: number) {
    const image = await this.captureBuffer(page, runId, timeout);
    return this.persistCapture(runId, name, stage, image, page.url());
  }

  private async completePassed(
    page: Page,
    runId: string,
    confirmation: { matched: boolean; type?: 'url' | 'redirect' | 'text' | 'selector' | 'default-text'; value?: string }
  ): Promise<void> {
    await this.capture(page, runId, '99-confirmation', 'confirmation');
    await this.store.update(runId, {
      status: 'passed',
      confirmation,
      completedAt: new Date().toISOString()
    });
  }

  private async createPdfArtifact(runId: string): Promise<void> {
    const current = this.store.get(runId);
    if (!current || current.artifacts.some(item => item.contentType === 'application/pdf')) return;
    const screenshots = current.artifacts.filter(item => item.contentType === 'image/png');
    if (screenshots.length === 0) return;

    const pdf = await PDFDocument.create();
    const titleFont = await pdf.embedFont(StandardFonts.HelveticaBold);
    for (const screenshot of screenshots) {
      const png = await pdf.embedPng(await readFile(this.store.artifactPath(runId, screenshot.name)));
      const maximumDimension = 14_000;
      const scale = Math.min(1, maximumDimension / Math.max(png.width, png.height));
      const width = Math.max(1, Math.floor(png.width * scale));
      const height = Math.max(1, Math.floor(png.height * scale));
      const title = pdfScreenshotTitle(current.request.url, screenshot.stage);
      const horizontalPadding = Math.min(28, Math.max(8, width * 0.02));
      const titleBarHeight = Math.min(64, Math.max(36, width * 0.045));
      let titleFontSize = Math.min(28, Math.max(16, titleBarHeight * 0.44));
      const availableTitleWidth = Math.max(1, width - horizontalPadding * 2);
      while (titleFontSize > 8 && titleFont.widthOfTextAtSize(title, titleFontSize) > availableTitleWidth) {
        titleFontSize -= 1;
      }
      const page = pdf.addPage([width, height + titleBarHeight]);
      page.drawImage(png, { x: 0, y: 0, width, height });
      page.drawLine({
        start: { x: 0, y: height },
        end: { x: width, y: height },
        thickness: 1,
        color: rgb(0.82, 0.84, 0.87)
      });
      page.drawText(title, {
        x: horizontalPadding,
        y: height + (titleBarHeight - titleFontSize) / 2,
        size: titleFontSize,
        font: titleFont,
        color: rgb(0.12, 0.15, 0.2)
      });
    }

    const fileName = `${runId}-form-report.pdf`;
    await writeFile(this.store.artifactPath(runId, fileName), await pdf.save());
    const latest = this.store.get(runId);
    if (!latest) return;
    await this.store.update(runId, {
      artifacts: [
        ...latest.artifacts,
        {
          name: fileName,
          stage: 'pdf-report',
          url: `/v1/form-runs/${runId}/artifacts/${fileName}`,
          contentType: 'application/pdf',
          createdAt: new Date().toISOString()
        }
      ]
    });
    logRun(runId, 'PDF_CREATED', { name: fileName, screenshotCount: screenshots.length });
  }
}

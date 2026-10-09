import { randomUUID } from 'node:crypto';
import type { FormField, GeneratedValue } from '../types.js';
import type { RunStore } from '../storage/run-store.js';
import { createStepWorkbook, readStepWorkbook } from '../form/step-workbook.js';
import { ExcelPayloadError } from '../form/excel-payload.js';
import { readHumanValues } from '../form/human-input.js';

export class StepInputError extends Error {}
type Submission = { values: GeneratedValue[]; useAI: boolean; actionId?: string | undefined; authorizeSubmit?: boolean | undefined };
type InputOptions = {
  kind?: 'fields' | 'action' | 'choice' | 'human-fields';
  choiceType?: 'select' | 'radio' | 'checkbox';
  choiceLabel?: string;
  actions?: Array<{ id: string; label: string; kind: 'next' | 'submit' }>;
  initialValues?: Map<string, string>;
  requireSubmitAuthorization?: boolean;
};
type Pending = {
  token: string;
  fields: FormField[];
  workbook: Buffer;
  resolve: (input: Submission) => void;
  reject: (error: Error) => void;
  accepting: boolean;
  options: InputOptions;
};

export class StepInput {
  private readonly pending = new Map<string, Pending>();
  constructor(private readonly store: RunStore) {}

  async wait(runId: string, fields: FormField[], step: number, pageUrl: string, signal: AbortSignal, expiresAt: string, message: string, token = randomUUID(), options: InputOptions = {}): Promise<Submission> {
    if (signal.aborted) throw new StepInputError('The browser session expired. Start a new run.');
    const actionOnly = options.kind === 'action' || options.kind === 'choice';
    const workbook = actionOnly || options.kind === 'human-fields' ? Buffer.alloc(0) : await createStepWorkbook(fields, token, pageUrl, step, options.initialValues);
    let abort = () => {};
    const submitted = new Promise<Submission>((resolve, reject) => {
      const entry: Pending = { token, fields, workbook, resolve, reject, accepting: true, options };
      this.pending.set(runId, entry);
      abort = () => reject(new StepInputError('The browser session expired. Start a new run.'));
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    });
    // Attach a rejection handler immediately while publishing the waiting state.
    void submitted.catch(() => {});
    try {
      await this.store.update(runId, { status: 'awaiting_input', error: undefined, inputRequest: {
        token, step, pageUrl, expiresAt, message,
        kind: options.kind ?? 'fields', actions: options.actions,
        choiceType: options.choiceType, choiceLabel: options.choiceLabel,
        ...(options.kind === 'human-fields' ? { fields } : {}),
        downloadUrl: options.kind === 'human-fields' ? '' : `/v1/form-runs/${runId}/input/${token}/excel`
      } });
      console.info(`[mlr-form] ${runId} | input ready | kind=${options.kind ?? 'fields'} | step=${step} | at=${new Date().toISOString()}`);
      return await submitted;
    } finally {
      signal.removeEventListener('abort', abort);
      this.pending.delete(runId);
      await this.store.update(runId, { inputRequest: undefined });
    }
  }

  download(runId: string, token: string): Buffer {
    const pending = this.pending.get(runId);
    if (!pending || pending.token !== token || !pending.accepting) throw new StepInputError('This step is no longer waiting for an upload.');
    if (pending.options.kind === 'human-fields') throw new StepInputError('This step uses direct form inputs, not Excel.');
    if (pending.options.kind === 'action') {
      throw new StepInputError('This step requires choosing the next action, not an Excel workbook.');
    }
    if (pending.options.kind === 'choice') {
      throw new StepInputError('This step requires choosing an option, not an Excel workbook.');
    }
    return pending.workbook;
  }

  async upload(runId: string, token: string, file: unknown, useAI: boolean, actionId?: string, authorizeSubmit = false, directValues?: unknown): Promise<void> {
    const pending = this.pending.get(runId);
    if (!pending || pending.token !== token || !pending.accepting) throw new StepInputError('This step is no longer waiting for an upload.');
    const actionOnly = pending.options.kind === 'action' || pending.options.kind === 'choice';
    if (actionOnly && !pending.options.actions?.some(action => action.id === actionId)) {
      throw new ExcelPayloadError('Choose one of the available form actions.');
    }
    const selectedAction = pending.options.actions?.find(action => action.id === actionId);
    if (actionOnly && selectedAction?.kind === 'submit' &&
      pending.options.requireSubmitAuthorization && !authorizeSubmit) {
      throw new ExcelPayloadError(`Authorize submission to continue with "${selectedAction.label}".`);
    }
    if (authorizeSubmit && (!actionOnly || selectedAction?.kind !== 'submit')) {
      throw new ExcelPayloadError('Submission authorization requires a selected submit action.');
    }
    const human = pending.options.kind === 'human-fields';
    if (human && (useAI || file !== undefined)) throw new ExcelPayloadError('Enter these values directly. AI and Excel cannot supply verification fields.');
    if (!human && directValues !== undefined) throw new ExcelPayloadError('Direct values are only accepted for displayed form fields.');
    const values = actionOnly ? [] : human ? readHumanValues(pending.fields, directValues) : await readStepWorkbook(file, pending.fields, token, useAI);
    if (this.pending.get(runId) !== pending || !pending.accepting) throw new StepInputError('This upload was already accepted or the step expired.');
    pending.accepting = false;
    try {
      await this.store.update(runId, { status: 'running', inputRequest: undefined });
      pending.resolve({ values, useAI: actionOnly ? false : useAI, actionId,
        ...(authorizeSubmit ? { authorizeSubmit: true } : {}) });
    } catch (error) {
      pending.reject(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  cancel(runId: string): void {
    const pending = this.pending.get(runId);
    if (!pending || !pending.accepting) throw new StepInputError('The run is not waiting for input.');
    pending.accepting = false;
    pending.reject(new StepInputError('The interactive run was cancelled. Start a new run when ready.'));
  }

  close(): void {
    for (const pending of this.pending.values()) pending.reject(new StepInputError('The server stopped. Start a new run to reopen the browser session.'));
  }
}

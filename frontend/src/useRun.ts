import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, errorMessage, excelPayload } from './api';
import type { Run, RunSettings } from './types';

const storageKey = 'active-form-run';
const isFinished = (run: Run) => !['queued', 'running', 'awaiting_input'].includes(run.status);

function savedRun(): string | null {
  try { return sessionStorage.getItem(storageKey); } catch { return null; }
}

function saveRun(id: string | null) {
  try {
    if (id) sessionStorage.setItem(storageKey, id);
    else sessionStorage.removeItem(storageKey);
  } catch { /* The current run still works when browser storage is unavailable. */ }
}

export function useRun(token: string) {
  const [runId, setRunId] = useState(savedRun);
  const restoredId = useRef(runId);
  const [run, setRun] = useState<Run | null>(null);
  const [operation, setOperation] = useState<'starting' | 'uploading' | 'cancelling' | null>(null);
  const [polling, setPolling] = useState(Boolean(runId));
  const [pollVersion, setPollVersion] = useState(0);
  const [error, setError] = useState('');
  const [inputError, setInputError] = useState('');
  const mutationLock = useRef(false);
  const pollAbort = useRef<AbortController | null>(null);
  const generation = useRef(0);

  // One request at a time, with the next poll scheduled only after it finishes.
  // A generation check also prevents pre-upload responses restoring an old page.
  useEffect(() => {
    if (!runId || !polling || operation) return;
    const version = ++generation.current;
    const controller = new AbortController();
    pollAbort.current = controller;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let reportPolls = 0;
    async function poll() {
      try {
        const next = await api<Run>(`/v1/form-runs/${encodeURIComponent(runId!)}`, token, { signal: controller.signal });
        if (controller.signal.aborted || version !== generation.current) return;
        setRun(next);
        setError('');
        if (isFinished(next)) {
          saveRun(null);
          // Reports are generated after the terminal status is published.
          const reportPending = next.artifacts.some(item => item.contentType === 'image/png') &&
            !next.artifacts.some(item => item.contentType === 'application/pdf');
          if (reportPending && reportPolls++ < 5) timer = setTimeout(() => void poll(), 1500);
          else setPolling(false);
        } else {
          saveRun(next.id);
          timer = setTimeout(() => void poll(), 1500);
        }
      } catch (failure) {
        if (controller.signal.aborted || version !== generation.current) return;
        setError(errorMessage(failure));
        setPolling(false);
        if (failure instanceof ApiError && failure.status === 404) {
          saveRun(null);
          setRunId(null);
          setRun(null);
        }
      }
    }
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
      if (generation.current === version) generation.current++;
    };
  }, [runId, polling, operation, pollVersion, token]);

  const beginMutation = (next: NonNullable<typeof operation>) => {
    if (mutationLock.current) return false;
    mutationLock.current = true;
    generation.current++;
    pollAbort.current?.abort();
    setOperation(next);
    return true;
  };

  async function start(settings: RunSettings, file?: File) {
    if ((runId && (!run || !isFinished(run))) || !beginMutation('starting')) return;
    setError('');
    setInputError('');
    setRun(null);
    setRunId(null);
    setPolling(false);
    try {
      const payloadExcel = settings.inputMode === 'automatic' ? await excelPayload(file) : undefined;
      const result = await api<{ runId: string }>('/v1/form-runs', token, {
        method: 'POST', body: JSON.stringify({ ...settings, payloadExcel })
      });
      saveRun(result.runId);
      setRunId(result.runId);
      setPolling(true);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      mutationLock.current = false;
      setOperation(null);
    }
  }

  async function upload(file: File | undefined, useAI: boolean, actionId?: string, authorizeSubmit = false, values?: Record<string, string>) {
    if (!run?.inputRequest || run.status !== 'awaiting_input' || !beginMutation('uploading')) return;
    setInputError('');
    try {
      const actionOnly = run.inputRequest.kind === 'action' || run.inputRequest.kind === 'choice';
      const human = run.inputRequest.kind === 'human-fields';
      if (actionOnly && !run.inputRequest.actions?.some(action => action.id === actionId)) {
        throw new Error('Choose one of the available actions to continue.');
      }
      if (!actionOnly && !human && !file) throw new Error('Select the filled Excel workbook for this page.');
      const payloadExcel = actionOnly || human ? undefined : await excelPayload(file);
      await api(`/v1/form-runs/${encodeURIComponent(run.id)}/input/${encodeURIComponent(run.inputRequest.token)}`, token, {
        method: 'POST', body: JSON.stringify(human ? { values } : actionOnly ? { actionId, useAI: false, ...(authorizeSubmit ? { authorizeSubmit: true } : {}) } : { payloadExcel, useAI })
      });
      setRun({ ...run, status: 'running', inputRequest: undefined });
    } catch (failure) {
      setInputError(errorMessage(failure));
    } finally {
      mutationLock.current = false;
      setOperation(null);
      setPolling(true);
      setPollVersion(value => value + 1);
    }
  }

  async function cancel() {
    if (!run?.inputRequest || !beginMutation('cancelling')) return;
    setInputError('');
    try {
      await api(`/v1/form-runs/${encodeURIComponent(run.id)}/cancel-input`, token, { method: 'POST', body: '{}' });
      setRun({ ...run, status: 'running', inputRequest: undefined });
    } catch (failure) {
      setInputError(errorMessage(failure));
    } finally {
      mutationLock.current = false;
      setOperation(null);
      setPolling(true);
      setPollVersion(value => value + 1);
    }
  }

  const retry = useCallback(() => {
    setError('');
    setPolling(true);
    setPollVersion(value => value + 1);
  }, []);

  return { run, runId, restoredId: restoredId.current, operation, error, inputError, setInputError,
    active: Boolean(operation || (runId && (!run || !isFinished(run)))), start, upload, cancel, retry };
}

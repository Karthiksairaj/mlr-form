import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArtifactGallery } from './ArtifactGallery';
import { HumanFields } from './HumanFields';
import { api, authHeaders, errorMessage, responseError } from './api';
import type { Health, InputMode, RunSettings } from './types';
import { useRun } from './useRun';

const initialSettings: RunSettings = { url: '', submit: false, inputMode: 'ai-guided' };

function WorkbookIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z" stroke="currentColor" strokeWidth="1.6" /><path d="M14 3v6h6M8 13h8M8 17h8M12 13v4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>;
}

export default function App() {
  const [settings, setSettings] = useState(initialSettings);
  const [token, setToken] = useState('');
  const [health, setHealth] = useState<Health | null>(null);
  const [healthFailed, setHealthFailed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [useAI, setUseAI] = useState(false);
  const [actionId, setActionId] = useState('');
  const [humanValues, setHumanValues] = useState<Record<string, string>>({});
  const [authorizeActionSubmit, setAuthorizeActionSubmit] = useState(false);
  const initialFile = useRef<HTMLInputElement>(null);
  const stepFile = useRef<HTMLInputElement>(null);
  const lastInput = useRef('');
  const restored = useRef(false);
  const downloadBusy = useRef(false);
  const downloads = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const runner = useRun(token);
  const { run, runId, active, operation } = runner;
  const input = run?.status === 'awaiting_input' ? run.inputRequest : undefined;
  const choiceOnly = input?.kind === 'choice';
  const humanOnly = input?.kind === 'human-fields';
  const aiGuided = (run?.request.inputMode ?? settings.inputMode) === 'ai-guided';
  const actionOnly = input?.kind === 'action' || choiceOnly;
  const samePageRetry = !actionOnly && !humanOnly && input?.message.startsWith('After clicking');
  const chosenAction = input?.actions?.find(action => action.id === actionId);

  useEffect(() => {
    const controller = new AbortController();
    api<Health>('/api/health', '', { signal: controller.signal }).then(setHealth).catch(() => {
      if (!controller.signal.aborted) setHealthFailed(true);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (run && run.id === runner.restoredId && !restored.current) {
      setSettings({ url: run.request.url, submit: run.request.submit,
        inputMode: run.request.inputMode || 'automatic', expectedOutcome: run.request.expectedOutcome });
      restored.current = true;
    }
  }, [run, runner.restoredId]);

  useEffect(() => {
    if (input && input.token !== lastInput.current) {
      lastInput.current = input.token;
      if (stepFile.current) stepFile.current.value = '';
      setUseAI(false);
      setActionId('');
      setHumanValues(Object.fromEntries((input.fields ?? []).map(field => [field.id, ['radio', 'checkbox'].includes(field.type) ? 'false' : ''])));
      setAuthorizeActionSubmit(false);
      runner.setInputError('');
    }
  }, [input?.token, runner.setInputError]);

  useEffect(() => {
    const urls = downloads.current;
    return () => { for (const [url, timer] of urls) { clearTimeout(timer); URL.revokeObjectURL(url); } urls.clear(); };
  }, []);

  function update<K extends keyof RunSettings>(key: K, value: RunSettings[K]) {
    setSettings(current => ({ ...current, [key]: value }));
  }

  function setExpected(key: 'urlContains' | 'textContains' | 'selector', value: string) {
    setSettings(current => ({ ...current, expectedOutcome: { ...current.expectedOutcome, [key]: value } }));
  }

  function start(event: FormEvent) {
    event.preventDefault();
    const expectedOutcome = Object.fromEntries(Object.entries(settings.expectedOutcome ?? {}).filter(([, value]) => value?.trim()).map(([key, value]) => [key, value.trim()]));
    void runner.start({ ...settings, url: settings.url.trim(), ...(Object.keys(expectedOutcome).length ? { expectedOutcome } : { expectedOutcome: undefined }) }, initialFile.current?.files?.[0]);
  }

  async function downloadWorkbook() {
    if (!input || actionOnly || downloadBusy.current) return;
    downloadBusy.current = true;
    setDownloading(true);
    runner.setInputError('');
    try {
      const response = await fetch(input.downloadUrl, { headers: authHeaders(token) });
      if (!response.ok) throw await responseError(response);
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `form-step-${input.step}.xlsx`;
      document.body.append(link);
      link.click();
      link.remove();
      const timer = setTimeout(() => { URL.revokeObjectURL(objectUrl); downloads.current.delete(objectUrl); }, 30_000);
      downloads.current.set(objectUrl, timer);
    } catch (failure) {
      runner.setInputError(errorMessage(failure));
    } finally {
      downloadBusy.current = false;
      setDownloading(false);
    }
  }

  const hasResult = Boolean(run || runId || operation || runner.error);
  const status = run ? (run.status === 'awaiting_input' ? actionOnly ? 'Waiting for your choice' : humanOnly ? 'Waiting for your answers' : 'Waiting for your Excel' : run.status.charAt(0).toUpperCase() + run.status.slice(1))
    : operation === 'starting' ? 'Opening form' : runId ? 'Restoring your run' : 'Unable to start';
  const runMessage = run?.error?.message || run?.confirmation?.value || (choiceOnly ? aiGuided ? 'Choose which form to load. AI will fill its general fields.' : 'Choose which form to load. The first Excel appears afterward.'
    : actionOnly ? 'Choose which action the runner should take on this page.'
    : input ? humanOnly ? 'Enter the requested choices and verification details below.' : 'Your browser session is ready. Add your answers to this page’s workbook.'
    : run?.status === 'running' ? `Working on page ${run.currentStep || 1}. ${aiGuided ? 'Any choices or verification fields will appear here.' : 'The next workbook will appear here.'}`
    : run?.status === 'queued' ? 'Your run is queued. The form will open shortly.'
    : run?.status === 'passed' ? 'The run completed successfully. Review the captured results below.'
    : run ? 'Review the run details and captured results below.'
    : operation === 'starting' ? 'Opening the form and detecting its fields…' : runId ? 'Reconnecting to the existing browser session…' : 'Review the message below and try again.');

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="/" aria-label="MLR Form Studio home"><span className="brand-mark"><WorkbookIcon /></span><span>MLR <strong>Form Studio</strong></span></a>
      <div className={`connection ${health ? 'online' : healthFailed ? 'offline' : ''}`} title={health?.dataGenerator.model || undefined}>
        <span className="connection-dot" />{health ? 'Backend connected' : healthFailed ? 'Backend unavailable' : 'Connecting…'}
      </div>
    </header>

    <main>
      <section className="intro">
        <p className="eyebrow">FORM TESTING, ONE PAGE AT A TIME</p>
        <h1>Your form. Your test data.</h1>
        <p className="lede">{aiGuided ? 'Let AI fill general fields. Provide conditional choices and verification details as the form progresses.' : 'Turn each form page into an Excel workbook. Fill in your values, upload, and keep going.'}</p>
        <ol className="workflow" aria-label="How it works">
          <li><span>1</span><div><strong>Open a form</strong><p>Paste your test form URL</p></div></li>
          <li><span>2</span><div><strong>{aiGuided ? 'AI fills general fields' : 'Fill the Excel'}</strong><p>{aiGuided ? 'You choose the conditional answers' : 'Download and add your answers'}</p></div></li>
          <li><span>3</span><div><strong>{aiGuided ? 'Verify & continue' : 'Upload & continue'}</strong><p>{aiGuided ? 'Enter your real details and codes' : 'Repeat for the next page'}</p></div></li>
        </ol>
      </section>

      <div className="workspace">
        <section className="panel setup-panel" aria-labelledby="setup-title">
          <div className="panel-heading"><span className="section-kicker">SETUP</span><h2 id="setup-title">Start a form run</h2><p>Choose how you want to provide the data.</p></div>
          <form id="run-form" onSubmit={start}>
            <label htmlFor="url">Test form URL</label>
            <input id="url" type="url" placeholder="https://test.example.com/form" value={settings.url} onChange={event => update('url', event.target.value)} required disabled={active} autoComplete="url" />

            <label htmlFor="inputMode">Filling mode</label>
            <select id="inputMode" value={settings.inputMode} onChange={event => update('inputMode', event.target.value as InputMode)} disabled={active}>
              <option value="ai-guided">AI with conditional inputs (no Excel)</option>
              <option value="excel-steps">Excel for each page</option>
              <option value="automatic">Automatic (AI / configured generator)</option>
            </select>
            <p className="field-help">{settings.inputMode === 'ai-guided' ? 'AI fills ordinary fields. You provide flow decisions and verified details such as NPI, card numbers and OTPs.' : settings.inputMode === 'excel-steps' ? 'You provide the values. A new workbook appears for each page.' : 'Excel values take priority. AI or the configured generator fills the remaining fields.'}</p>

            <div id="initial-payload" className={settings.inputMode === 'automatic' ? 'initial-payload' : 'hidden'}>
              <label htmlFor="payloadExcel">Excel payload <span className="optional">optional</span></label>
              <input ref={initialFile} id="payloadExcel" type="file" accept=".xlsx" disabled={active} aria-describedby="payload-help" />
              <p className="field-help" id="payload-help">Use Field and Value columns in the first sheet or a sheet named Payload. Match form field names or labels. Store values as Text to keep leading zeros. Maximum 1 MB.</p>
            </div>

            <details className="advanced-settings">
              <summary>Advanced settings <span>Optional</span></summary>
              <div className="advanced-content">
                <p className="field-help">Tell the runner what a successful completion looks like.</p>
                <label htmlFor="urlContains">Confirmation URL contains</label><input id="urlContains" value={settings.expectedOutcome?.urlContains ?? ''} onChange={event => setExpected('urlContains', event.target.value)} placeholder="/thank-you" disabled={active} />
                <label htmlFor="textContains">Confirmation page text contains</label><input id="textContains" value={settings.expectedOutcome?.textContains ?? ''} onChange={event => setExpected('textContains', event.target.value)} placeholder="Thank you" disabled={active} />
                <label htmlFor="selector">Confirmation CSS selector</label><input id="selector" value={settings.expectedOutcome?.selector ?? ''} onChange={event => setExpected('selector', event.target.value)} placeholder="[data-testid='success']" disabled={active} />
                <label htmlFor="token">API bearer token</label><input id="token" type="password" value={token} onChange={event => setToken(event.target.value)} autoComplete="off" spellCheck={false} aria-describedby="token-help" />
                <p className="field-help" id="token-help">Only needed if authentication is configured. Re-enter after a refresh.</p>
              </div>
            </details>

            <label className="checkbox authorization" htmlFor="submit"><input id="submit" type="checkbox" checked={settings.submit} onChange={event => update('submit', event.target.checked)} disabled={active} /><span>I authorize submission to this approved test form.<small>Leave unchecked to stop before submission, including buttons that open the next flow.</small></span></label>
            <button id="start" className="primary start-button" type="submit" disabled={active}>{operation === 'starting' ? 'Opening form…' : active ? 'Run in progress' : settings.inputMode === 'ai-guided' ? 'Start guided AI run' : settings.inputMode === 'automatic' ? 'Start run' : 'Open form and prepare Excel'}<span aria-hidden="true">→</span></button>
          </form>
        </section>

        <div className="work-column">
          {!hasResult && <section className="panel empty-state" aria-labelledby="empty-title">
            {!aiGuided && <div className="workbook-illustration" aria-hidden="true"><div className="sheet-back" /><div className="sheet-front"><WorkbookIcon /><div className="sheet-lines"><i /><i /><i /></div><span>.xlsx</span></div><span className="ready-dot">✓</span></div>}
            <span className="section-kicker">YOUR WORKSPACE</span><h2 id="empty-title">Ready when you are</h2><p>{aiGuided ? 'AI handles general fields. Conditional choices and verification details appear here for you to enter.' : 'Open a form to get its first workbook. Each page’s Excel and run results will appear here.'}</p>
            <div className="empty-note"><WorkbookIcon /><span>Use your own test values for fields like<br className="desktop-break" /> NPI and card activation numbers.</span></div>
          </section>}

          <section id="result" className={`panel result-panel ${hasResult ? '' : 'hidden'}`} aria-labelledby="status">
            <div className="result-header"><div><span className="section-kicker">RUN WORKSPACE</span><h2 id="status" aria-live="polite">{status}</h2></div><span className={`status-badge ${run?.status ?? 'queued'}`}>{run?.status === 'awaiting_input' ? 'Your turn' : run?.status === 'passed' ? 'Complete' : active ? 'In progress' : run?.status ?? 'Check setup'}</span></div>
            <p id="message" className="run-message" aria-live="polite">{runMessage}</p>
            {runner.error && <div className="error-box" role="alert"><p>{runner.error}</p>{runId && <button type="button" className="text-button" onClick={runner.retry}>Retry connection</button>}</div>}

            <section id="step-input" className={`step-input ${input ? '' : 'hidden'}`} aria-labelledby="input-title">
              <div className="input-heading"><span className="workbook-badge"><WorkbookIcon /></span><div><span className="section-kicker">ACTION NEEDED</span><h3 id="input-title">{humanOnly ? 'Enter choices and verification details' : choiceOnly ? 'Choose which form to load' : `${actionOnly ? 'Choose an action for page' : samePageRetry ? 'Correct or retry page' : 'Excel for page'} ${input?.step ?? 1}`}</h3></div></div>
              <p id="input-message">{input?.message}</p>
              {samePageRetry && <p className="field-help" role="status">The site stayed on this form after submission. This is a retry workbook with your previous answers, not a new page. Check the latest screenshot for the site’s message.</p>}
              {!actionOnly && !humanOnly && <div className="download-row"><div><strong>1. {samePageRetry ? 'Review the retry workbook' : 'Download & fill'}</strong><p>{samePageRetry ? 'Your earlier answers are already filled. Change only values you need to correct.' : 'Enter your answers in the Value column.'}</p></div><button id="download-step" className="secondary" type="button" onClick={() => void downloadWorkbook()} disabled={downloading || Boolean(operation)}><span aria-hidden="true">↓</span> {downloading ? 'Downloading…' : samePageRetry ? 'Download retry Excel' : `Download Excel for page ${input?.step ?? 1}`}</button></div>}
              <form id="step-upload-form" onSubmit={event => { event.preventDefault(); void runner.upload(actionOnly || humanOnly ? undefined : stepFile.current?.files?.[0], actionOnly || humanOnly ? false : useAI, actionOnly ? actionId : undefined, actionOnly && authorizeActionSubmit, humanOnly ? humanValues : undefined); }}>
                {actionOnly ? <>
                  {choiceOnly && (input.choiceType === 'radio' || input.choiceType === 'checkbox')
                    ? <fieldset className="human-choice-group route-choice"><legend>{input.choiceLabel || 'Choose a form'}</legend>
                      {input.actions?.map(action => <label className="checkbox" key={action.id} htmlFor={`choice-${action.id}`}>
                        <input id={`choice-${action.id}`} name="route-choice" type={input.choiceType}
                          checked={actionId === action.id} required disabled={Boolean(operation)}
                          onChange={() => { setActionId(action.id); setAuthorizeActionSubmit(false); }} />
                        <span>{action.label}</span></label>)}
                    </fieldset>
                    : <><label htmlFor="next-action">{choiceOnly ? input.choiceLabel || 'Condition or route' : 'Next action'}</label>
                      <select id="next-action" value={actionId} onChange={event => { setActionId(event.target.value); setAuthorizeActionSubmit(false); }} required disabled={Boolean(operation)}>
                        <option value="" disabled>{choiceOnly ? 'Choose a form' : 'Choose the next action'}</option>
                        {input.actions?.map(action => <option key={action.id} value={action.id}>{action.label}</option>)}
                      </select></>}
                  {chosenAction?.kind === 'submit' && !run?.request.submit &&
                    <label className="checkbox authorization" htmlFor="authorize-action-submit"><input id="authorize-action-submit" type="checkbox" checked={authorizeActionSubmit} onChange={event => setAuthorizeActionSubmit(event.target.checked)} required disabled={Boolean(operation)} /><span>I authorize submission with “{chosenAction.label}”.<small>This sends the filled form to the site and may open another form. You can approve later submissions when they appear.</small></span></label>}
                </> : humanOnly ? <HumanFields fields={input?.fields ?? []} values={humanValues} onChange={setHumanValues} disabled={Boolean(operation)} /> : <><label htmlFor="stepExcel">2. Upload your filled Excel</label>
                <div className="file-zone"><input ref={stepFile} id="stepExcel" type="file" accept=".xlsx" required disabled={Boolean(operation)} aria-describedby="step-file-help" /><p className="field-help" id="step-file-help">Use this page’s workbook. Excel .xlsx · up to 1 MB</p></div>
                <label className="checkbox" htmlFor="step-use-ai"><input id="step-use-ai" type="checkbox" checked={useAI} onChange={event => setUseAI(event.target.checked)} disabled={Boolean(operation)} /><span>Use AI / configured generator for blank values<small>Leave off to use only the values you provide.</small></span></label></>}
                <p id="input-error" className={runner.inputError ? 'error-box' : 'input-error-empty'} role="alert">{runner.inputError}</p>
                <button id="upload-step" className="primary" type="submit" disabled={Boolean(operation)}>{operation === 'uploading' ? choiceOnly ? 'Loading form…' : actionOnly || humanOnly ? 'Continuing…' : 'Uploading…' : humanOnly ? 'Continue with these answers' : choiceOnly ? 'Load selected form' : actionOnly ? 'Continue with selected action' : 'Upload and continue'}<span aria-hidden="true">→</span></button>
              </form>
              <div className="session-row"><p id="input-expiry">Session open until {input ? new Date(input.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}. Keep this run open while editing.</p><button id="cancel-input" type="button" className="text-button cancel-button" onClick={() => void runner.cancel()} disabled={Boolean(operation)}>{operation === 'cancelling' ? 'Cancelling…' : 'Cancel run'}</button></div>
            </section>

            {!input && active && <div className="processing"><span className="spinner" /><span>{operation === 'starting' ? 'Preparing your session' : runId && !run ? 'Loading run details' : 'The runner is working on your form'}</span></div>}
            {run && run.steps.length > 0 && <section className="progress-section" aria-labelledby="progress-title"><div className="section-heading"><h3 id="progress-title">Page progress</h3><span className="count">{run.steps.filter(step => step.status === 'completed').length} completed</span></div><ol id="steps" className="steps">{run.steps.map(step => <li key={step.number}><span className={`step-number ${step.status}`}>{step.status === 'completed' ? '✓' : step.number}</span><div><strong>Page {step.number}</strong><span>{step.fieldCount} fields{step.action ? ` · ${step.action}` : ''}</span></div><span className={`step-status ${step.status}`}>{step.status}</span></li>)}</ol></section>}
            {run && Boolean(run.networkDiagnostics?.length) && <section className="network-section" aria-labelledby="network-title"><div className="section-heading"><h3 id="network-title">Network after button click</h3><span className="count">{run.networkDiagnostics?.length}</span></div><ol className="network-events">{run.networkDiagnostics?.slice(-12).map((event, index) => <li key={`${event.step}-${event.action}-${index}`}><strong>{event.method} {event.endpoint}</strong><span>Page {event.step} · {event.action} · {event.failure ?? `HTTP ${event.status ?? 'pending'}`}</span>{event.signals && <code>{Object.entries(event.signals).map(([name, value]) => `${name}=${value}`).join(' · ')}</code>}{event.captchaTokenInBody && <code>CAPTCHA token in submit body: {event.captchaTokenInBody.replace('_', ' ')}</code>}{Boolean(event.responseHints?.length) && <code>Response mentions: {event.responseHints?.join(', ')}</code>}</li>)}</ol></section>}
            {run && run.artifacts.length > 0 && <ArtifactGallery artifacts={run.artifacts} token={token} />}
            <div className="run-reference"><span>Run ID</span><code id="run-id">{runId ?? '—'}</code></div>
          </section>
          <p className="workspace-note">{aiGuided ? 'Your verification details are entered into the site. If a code is sent to your email or phone, enter it here when requested.' : 'Your values are sent to the form for validation. A rejected value can be corrected and uploaded again.'}</p>
        </div>
      </div>
    </main>
    <footer><span>MLR Form Studio</span><span>{aiGuided ? 'AI assistance · Your verification details · Screenshots & reports' : 'Excel input · AI assistance · Screenshots & reports'}</span></footer>
  </div>;
}

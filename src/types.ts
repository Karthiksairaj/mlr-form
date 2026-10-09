export type RunStatus =
  | 'queued'
  | 'running'
  | 'awaiting_input'
  | 'passed'
  | 'failed'
  | 'blocked'
  | 'inconclusive';

export type ExpectedOutcome = {
  urlContains?: string | undefined;
  textContains?: string | undefined;
  selector?: string | undefined;
};

export type CreateRunInput = {
  url: string;
  scenario: string;
  submit: boolean;
  maxSteps: number;
  inputMode?: 'automatic' | 'excel-steps' | 'ai-guided' | undefined;
  payload?: Record<string, string> | undefined;
  expectedOutcome?: ExpectedOutcome | undefined;
};

export type Artifact = {
  name: string;
  stage: string;
  url: string;
  contentType: 'image/png' | 'application/pdf';
  createdAt: string;
};

export type RunStep = {
  number: number;
  status: 'started' | 'completed' | 'failed';
  fieldCount: number;
  action?: string | undefined;
  submissionAuthorized?: boolean | undefined;
  screenshot?: string | undefined;
};

export type NetworkDiagnostic = {
  step: number;
  action: string;
  method: string;
  endpoint: string;
  status?: number;
  failure?: string;
  signals?: Record<string, boolean | number | string>;
  responseHints?: Array<'captcha' | 'csrf' | 'session' | 'validation' | 'duplicate' | 'authorization'>;
  captchaTokenInBody?: 'present' | 'empty' | 'not_observed';
};

export type RunRecord = {
  id: string;
  request: CreateRunInput;
  status: RunStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | undefined;
  completedAt?: string | undefined;
  currentStep: number;
  formDetected: boolean;
  inputRequest?: {
    token: string;
    step: number;
    pageUrl: string;
    downloadUrl: string;
    expiresAt: string;
    message: string;
    kind?: 'fields' | 'action' | 'choice' | 'human-fields' | undefined;
    choiceType?: 'select' | 'radio' | 'checkbox' | undefined;
    choiceLabel?: string | undefined;
    fields?: FormField[] | undefined;
    actions?: Array<{ id: string; label: string; kind: 'next' | 'submit' }> | undefined;
  } | undefined;
  steps: RunStep[];
  artifacts: Artifact[];
  networkDiagnostics?: NetworkDiagnostic[] | undefined;
  captcha: {
    detected: boolean;
    provider?: string | undefined;
    blocking?: boolean | undefined;
    action?: 'observed' | 'submission-skipped' | 'submission-blocked' | undefined;
  };
  dataGeneration?: {
    provider: 'local' | 'openai' | 'claude' | 'gemini';
    model?: string | undefined;
    requests: number;
    validationRetries: number;
    fallbackCount: number;
  } | undefined;
  confirmation?: {
    matched: boolean;
    type?: 'url' | 'redirect' | 'text' | 'selector' | 'default-text' | undefined;
    value?: string | undefined;
  } | undefined;
  branchOutcomes?: Array<{
    path: string;
    matched: boolean;
    type?: 'url' | 'redirect' | 'text' | 'selector' | 'default-text' | undefined;
    value?: string | undefined;
    screenshot?: string | undefined;
  }> | undefined;
  error?: {
    code: string;
    message: string;
  } | undefined;
};

export type FormField = {
  id: string;
  domId?: string | undefined;
  /** URL of the child frame containing the field; omitted for the main document. */
  frameUrl?: string | undefined;
  tag: 'input' | 'select' | 'textarea';
  type: string;
  label: string;
  /** Question shared by options in a radio or checkbox group. */
  question?: string | undefined;
  /** Authored value for a radio/checkbox option, separate from its visible label. */
  choiceValue?: string | undefined;
  /** The containing checkbox group requires at least one selected option. */
  groupRequired?: boolean | undefined;
  name?: string | undefined;
  placeholder?: string | undefined;
  autocomplete?: string | undefined;
  required: boolean;
  disabled: boolean;
  readOnly: boolean;
  minLength?: number | undefined;
  maxLength?: number | undefined;
  min?: string | undefined;
  max?: string | undefined;
  pattern?: string | undefined;
  options?: Array<{ value: string; label: string }> | undefined;
};

export type GeneratedValue = {
  fieldId: string;
  value: string;
};

import type { Page, Request, Response } from 'playwright';
import type { NetworkDiagnostic } from '../types.js';

function endpoint(url: string): string {
  try {
    const parsed = new URL(url);
    // Query strings can contain tokens or submitted values. Dynamic path
    // segments are redacted for the same reason.
    const path = parsed.pathname.split('/').map(segment =>
      segment.length > 80 || /@|\b\d{5,}\b|[a-f0-9]{16,}/iu.test(segment) ? ':redacted' : segment).join('/');
    return `${parsed.origin}${path}`;
  } catch {
    return '[unavailable]';
  }
}

function relevant(request: Request, status?: number): boolean {
  return request.method() !== 'GET' || (status !== undefined && status >= 400);
}

function responseSignals(value: unknown): Record<string, boolean | number | string> {
  const signals: Record<string, boolean | number | string> = {};
  const visit = (node: unknown, prefix: string, depth: number): void => {
    if (!node || typeof node !== 'object' || Array.isArray(node) || depth > 3) return;
    for (const [key, item] of Object.entries(node)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof item === 'boolean' && /^(?:isStatusSuccessful|success|successful|valid)$/iu.test(key)) {
        signals[path] = item;
      } else if (typeof item === 'number' && /^(?:statusCode|errorCode|code)$/iu.test(key)) {
        signals[path] = item;
      } else if (typeof item === 'string' && /^(?:errorCode|statusCode)$/iu.test(key) &&
        /^[a-z][a-z0-9_-]{0,39}$/iu.test(item) && !/\d{4,}/u.test(item)) {
        signals[path] = item;
      } else if (typeof item === 'object') visit(item, path, depth + 1);
    }
  };
  visit(value, '', 0);
  return signals;
}

function responseHints(body: string): NonNullable<NetworkDiagnostic['responseHints']> {
  const matches: Array<[NonNullable<NetworkDiagnostic['responseHints']>[number], RegExp]> = [
    ['captcha', /\b(?:re)?captcha\b/iu],
    ['csrf', /\b(?:csrf|xsrf)\b/iu],
    ['session', /\b(?:session|expired|expiry)\b/iu],
    ['validation', /\b(?:validat\w*|invalid|missing|required|malformed)\b/iu],
    ['duplicate', /\b(?:duplicat\w*|already registered|already exists)\b/iu],
    ['authorization', /\b(?:unauthorized|forbidden|access denied)\b/iu]
  ];
  return matches.filter(([, pattern]) => pattern.test(body)).map(([hint]) => hint);
}

function captchaTokenInBody(request: Request): NonNullable<NetworkDiagnostic['captchaTokenInBody']> | undefined {
  if (request.method() !== 'POST' || !/\/af\/submit\//iu.test(new URL(request.url()).pathname)) return;
  // Only retain the presence of a token. The submitted fields and token stay
  // in memory and never enter the run record or log.
  const body = request.postData();
  if (body === null) return 'not_observed';
  const match = body.match(/(?:^|[&?])(?:g-recaptcha-response|recaptcha(?:Response|Token))=([^&]*)|["'](?:g-recaptcha-response|recaptcha(?:Response|Token))["']\s*:\s*["']([^"']*)["']|name=["'](?:g-recaptcha-response|recaptcha(?:Response|Token))["'][^\r\n]*\r?\n\r?\n([^\r\n]*)/iu);
  if (!match) return 'not_observed';
  const value = match[1] ?? match[2] ?? match[3] ?? '';
  return value.length > 0 ? 'present' : 'empty';
}

async function responseTextWithin(response: Response, timeoutMs: number): Promise<string | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      response.text().catch(() => undefined),
      new Promise<undefined>(resolve => { timer = setTimeout(() => resolve(undefined), timeoutMs); })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Observe one button click and its transition without saving request bodies, response bodies, headers, or query strings. */
export async function captureActionNetwork<T>(
  page: Page,
  step: number,
  action: string,
  operation: () => Promise<T>
): Promise<{ result: T; diagnostics: NetworkDiagnostic[] }> {
  const diagnostics: NetworkDiagnostic[] = [];
  const pending: Promise<void>[] = [];
  const inFlight = new Map<Request, () => void>();
  const started: Promise<void>[] = [];
  const onRequest = (request: Request): void => {
    if (!relevant(request)) return;
    started.push(new Promise<void>(resolve => inFlight.set(request, resolve)));
  };
  const onResponse = (response: Response): void => {
    const request = response.request();
    inFlight.get(request)?.();
    inFlight.delete(request);
    if (!relevant(request, response.status()) || diagnostics.length >= 40) return;
    const item: NetworkDiagnostic = {
      step, action, method: request.method(), endpoint: endpoint(request.url()), status: response.status()
    };
    const tokenState = captchaTokenInBody(request);
    if (tokenState) item.captchaTokenInBody = tokenState;
    diagnostics.push(item);
    const contentType = response.headers()['content-type'] ?? '';
    const contentLength = Number(response.headers()['content-length'] ?? 0);
    const failedAtSite = response.status() >= 400 &&
      new URL(request.url()).hostname === new URL(page.url()).hostname;
    if (contentLength <= 65_536 && (/\bjson\b/iu.test(contentType) ||
      (failedAtSite && /\btext\/plain\b/iu.test(contentType)))) {
      pending.push(responseTextWithin(response, 1_000).then(body => {
        if (body === undefined || body.length > 65_536) return;
        if (/\bjson\b/iu.test(contentType)) {
          try {
            const signals = responseSignals(JSON.parse(body));
            if (Object.keys(signals).length) item.signals = signals;
          } catch { /* The server did not return valid JSON. */ }
        }
        if (failedAtSite) {
          const hints = responseHints(body);
          if (hints.length) item.responseHints = hints;
        }
      }));
    }
  };
  const onRequestFailed = (request: Request): void => {
    inFlight.get(request)?.();
    inFlight.delete(request);
    if (!relevant(request) || diagnostics.length >= 40) return;
    const failure = request.failure()?.errorText ?? 'request_failed';
    diagnostics.push({ step, action, method: request.method(), endpoint: endpoint(request.url()),
      failure: /^net::ERR_[A-Z_]+$/u.test(failure) ? failure : 'request_failed' });
  };
  page.on('request', onRequest);
  page.on('response', onResponse);
  page.on('requestfailed', onRequestFailed);
  try {
    const result = await operation();
    if (started.length > 0) {
      await new Promise<void>(resolve => {
        const timer = setTimeout(resolve, 2_000);
        Promise.allSettled(started).then(() => { clearTimeout(timer); resolve(); });
      });
    }
    await Promise.allSettled(pending);
    return { result, diagnostics };
  } finally {
    page.off('request', onRequest);
    page.off('response', onResponse);
    page.off('requestfailed', onRequestFailed);
  }
}

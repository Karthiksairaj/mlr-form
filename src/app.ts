import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { createRunSchema } from './schemas.js';
import { assertSafeUrl, UrlPolicyError } from './security/url-policy.js';
import type { JobQueue } from './queue/job-queue.js';
import type { FormRunner } from './runner/form-runner.js';
import type { RunStore } from './storage/run-store.js';
import type { RunRecord } from './types.js';
import { withoutPayload } from './storage/run-store.js';
import { ExcelPayloadError, parseExcelPayload } from './form/excel-payload.js';
import { StepInputError } from './runner/step-input.js';

export type AppDependencies = {
  store: RunStore;
  queue: JobQueue;
  runner: FormRunner;
  apiToken?: string;
  allowedTargetHosts: Set<string>;
  allowPrivateNetworks: boolean;
  maxSteps: number;
  dataGenerator: {
    provider: 'local' | 'openai' | 'claude' | 'gemini';
    model?: string | undefined;
  };
};

export async function buildApp(dependencies: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      redact: ['req.headers.authorization', 'request.headers.authorization']
    },
    bodyLimit: 2 * 1024 * 1024
  });

  const frontendRoot = path.resolve('frontend/dist');
  if (existsSync(path.join(frontendRoot, 'index.html'))) {
    await app.register(fastifyStatic, { root: frontendRoot, prefix: '/' });
  } else {
    app.get('/', async (_request, reply) => reply.code(503).type('text/plain').send(
      'React UI is not built. Use http://127.0.0.1:5173 during development, or run npm run build:ui.'
    ));
  }
  app.get('/demo-form.html', async (_request, reply) => reply.type('text/html').send(
    createReadStream(path.resolve('public/demo-form.html'))
  ));

  app.addHook('onRequest', async (request, reply) => {
    const protectedApi = request.url.startsWith('/v1/') ||
      (request.url.startsWith('/api/') && request.url !== '/api/health');
    if (!protectedApi) return;
    if (!dependencies.apiToken) return;
    if (request.headers.authorization !== `Bearer ${dependencies.apiToken}`) {
      await reply.code(401).send({ error: 'unauthorized', message: 'A valid bearer token is required.' });
    }
  });

  app.get('/api/health', async () => ({
    status: 'ok',
    dataGenerator: dependencies.dataGenerator,
    implementedPoCs: ['P1', 'P2', 'P3', 'P4', 'P5'],
    formCapabilities: [
      'iframe-forms',
      'all-select-option-branches',
      'all-radio-option-branches',
      'dynamic-form-state-transitions',
      'delayed-conditional-forms',
      'custom-checkbox-radio-controls',
      'transient-navigation-retry',
      'captcha-detection-and-safe-skip',
      'post-submit-confirmation-validation',
      'openai-claude-gemini-data-generation',
      'validated-local-data-fallback',
      'page-by-page-excel-input'
    ]
  }));

  app.post('/v1/form-runs', async (request, reply) => {
    const body = request.body as { payloadExcel?: unknown; payload?: unknown } | undefined;
    if (body?.payload !== undefined) throw new ExcelPayloadError('Supply payloadExcel using an Excel .xlsx file.');
    const payload = body?.payloadExcel === undefined ? undefined : await parseExcelPayload(body.payloadExcel);
    const parsed = createRunSchema.parse({
      ...(request.body as object),
      payload,
      maxSteps: (request.body as { maxSteps?: number } | undefined)?.maxSteps ?? dependencies.maxSteps
    });
    if ((parsed.inputMode === 'excel-steps' || parsed.inputMode === 'ai-guided') && payload !== undefined) {
      throw new ExcelPayloadError('Start the run without an Excel file. Download and upload the workbook for each step.');
    }
    await assertSafeUrl(parsed.url, {
      allowedHosts: dependencies.allowedTargetHosts,
      allowPrivateNetworks: dependencies.allowPrivateNetworks,
      requireAllowedHost: dependencies.allowedTargetHosts.size > 0
    });

    const now = new Date().toISOString();
    const record: RunRecord = {
      id: randomUUID(),
      request: parsed,
      status: 'queued',
      createdAt: now,
      updatedAt: now,
      currentStep: 0,
      formDetected: false,
      steps: [],
      artifacts: [],
      captcha: { detected: false },
      dataGeneration: {
        provider: dependencies.dataGenerator.provider,
        ...(dependencies.dataGenerator.model ? { model: dependencies.dataGenerator.model } : {}),
        requests: 0,
        validationRetries: 0,
        fallbackCount: 0
      }
    };
    await dependencies.store.create(record);
    dependencies.queue.enqueue(() => dependencies.runner.run(record.id));
    return reply.code(202).send({
      runId: record.id,
      status: record.status,
      statusUrl: `/v1/form-runs/${record.id}`
    });
  });

  app.get<{ Params: { runId: string } }>('/v1/form-runs/:runId', async (request, reply) => {
    const record = dependencies.store.get(request.params.runId);
    if (!record) return reply.code(404).send({ error: 'not_found', message: 'Run not found.' });
    return withoutPayload(record);
  });

  app.get<{ Params: { runId: string; token: string } }>('/v1/form-runs/:runId/input/:token/excel', async (request, reply) => {
    const buffer = dependencies.runner.stepInput.download(request.params.runId, request.params.token);
    const step = dependencies.store.get(request.params.runId)?.currentStep ?? 1;
    return reply.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('content-disposition', `attachment; filename="form-step-${step}.xlsx"`)
      .header('cache-control', 'no-store').send(buffer);
  });

  app.post<{ Params: { runId: string; token: string } }>('/v1/form-runs/:runId/input/:token', async (request, reply) => {
    const body = request.body as { payloadExcel?: unknown; useAI?: unknown; actionId?: unknown; authorizeSubmit?: unknown; values?: unknown } | undefined;
    if (body?.useAI !== undefined && typeof body.useAI !== 'boolean') throw new ExcelPayloadError('useAI must be true or false.');
    if (body?.actionId !== undefined && typeof body.actionId !== 'string') throw new ExcelPayloadError('actionId must identify an available form action.');
    if (body?.authorizeSubmit !== undefined && typeof body.authorizeSubmit !== 'boolean') throw new ExcelPayloadError('authorizeSubmit must be true or false.');
    await dependencies.runner.stepInput.upload(request.params.runId, request.params.token, body?.payloadExcel, body?.useAI === true,
      body?.actionId as string | undefined, body?.authorizeSubmit === true, body?.values);
    return reply.code(202).send({ status: 'running', runId: request.params.runId });
  });

  app.post<{ Params: { runId: string } }>('/v1/form-runs/:runId/cancel-input', async (request, reply) => {
    dependencies.runner.stepInput.cancel(request.params.runId);
    return reply.code(202).send({ status: 'cancelling' });
  });

  app.get<{ Params: { runId: string } }>('/v1/form-runs/:runId/artifacts', async (request, reply) => {
    const record = dependencies.store.get(request.params.runId);
    if (!record) return reply.code(404).send({ error: 'not_found', message: 'Run not found.' });
    return { runId: record.id, artifacts: record.artifacts };
  });

  app.get<{ Params: { runId: string; name: string } }>(
    '/v1/form-runs/:runId/artifacts/:name',
    async (request, reply) => {
      const record = dependencies.store.get(request.params.runId);
      const artifact = record?.artifacts.find(item => item.name === request.params.name);
      if (!record || !artifact || !/^[a-zA-Z0-9._-]+\.(?:png|pdf)$/u.test(request.params.name)) {
        return reply.code(404).send({ error: 'not_found', message: 'Artifact not found.' });
      }
      reply.type(artifact.contentType);
      return reply.send(createReadStream(dependencies.store.artifactPath(record.id, artifact.name)));
    }
  );

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof StepInputError) {
      return reply.code(409).send({ error: 'step_not_waiting', message: error.message });
    }
    if (error instanceof ExcelPayloadError) {
      return reply.code(400).send({ error: 'invalid_excel_payload', message: error.message });
    }
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: 'invalid_request',
        message: 'The request did not match the API contract.',
        details: error.issues
      });
    }
    if (error instanceof UrlPolicyError) {
      return reply.code(400).send({ error: error.code, message: error.message });
    }
    app.log.error(error);
    return reply.code(500).send({ error: 'internal_error', message: 'Unexpected server error.' });
  });

  app.addHook('onClose', async () => {
    await dependencies.runner.close();
  });

  return app;
}

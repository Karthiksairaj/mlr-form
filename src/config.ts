import 'dotenv/config';
import path from 'node:path';
import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform(value => value === 'true');

const optionalAiProvider = z.preprocess(
  value => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.enum(['local', 'openai', 'claude', 'gemini']).optional()
);

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('127.0.0.1'),
  AI_PROVIDER: optionalAiProvider,
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  // Legacy provider-specific names remain supported for existing deployments.
  DATA_GENERATOR_PROVIDER: z.enum(['local', 'openai', 'claude']).optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-5.4-mini'),
  ANTHROPIC_API_KEY: z.string().optional(),
  CLAUDE_MODEL: z.string().default('claude-sonnet-4-5'),
  API_TOKEN: z.string().optional(),
  ALLOWED_TARGET_HOSTS: z.string().default(''),
  ALLOW_PRIVATE_NETWORKS: booleanString,
  ARTIFACT_DIR: z.string().default('work/artifacts'),
  RUN_TIMEOUT_MS: z.coerce.number().int().min(10_000).default(1_800_000),
  FORM_READY_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(30_000),
  INITIAL_FORM_READY_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(600_000).default(180_000),
  MAX_CONCURRENT_RUNS: z.coerce.number().int().min(1).max(10).default(1),
  MAX_STEPS: z.coerce.number().int().min(1).max(25).default(10),
  HEADLESS: z
    .enum(['true', 'false'])
    .default('true')
    .transform(value => value === 'true')
});

const parsed = schema.parse(process.env);
const inferredProvider = parsed.AI_MODEL?.startsWith('gpt-') || parsed.AI_MODEL?.startsWith('o')
  ? 'openai'
  : parsed.AI_MODEL?.startsWith('claude-')
    ? 'claude'
    : parsed.AI_MODEL?.startsWith('gemini-')
      ? 'gemini'
      : undefined;
const dataGeneratorProvider = parsed.AI_PROVIDER ?? inferredProvider ?? parsed.DATA_GENERATOR_PROVIDER ?? 'local';
const aiApiKey = parsed.AI_API_KEY || (
  dataGeneratorProvider === 'openai'
    ? parsed.OPENAI_API_KEY
    : dataGeneratorProvider === 'claude'
      ? parsed.ANTHROPIC_API_KEY
      : undefined
);
const aiModel = parsed.AI_MODEL || (
  dataGeneratorProvider === 'openai'
    ? parsed.OPENAI_MODEL
    : dataGeneratorProvider === 'claude'
      ? parsed.CLAUDE_MODEL
      : dataGeneratorProvider === 'gemini'
        ? 'gemini-3.6-flash'
        : undefined
);

export const config = {
  port: parsed.PORT,
  host: parsed.HOST,
  dataGeneratorProvider,
  aiApiKey,
  aiModel,
  openaiApiKey: parsed.OPENAI_API_KEY,
  openaiModel: parsed.OPENAI_MODEL,
  anthropicApiKey: parsed.ANTHROPIC_API_KEY,
  claudeModel: parsed.CLAUDE_MODEL,
  apiToken: parsed.API_TOKEN,
  allowedTargetHosts: new Set(
    parsed.ALLOWED_TARGET_HOSTS.split(',')
      .map(host => host.trim().toLowerCase())
      .filter(Boolean)
  ),
  allowPrivateNetworks: parsed.ALLOW_PRIVATE_NETWORKS,
  artifactDir: path.resolve(parsed.ARTIFACT_DIR),
  runTimeoutMs: parsed.RUN_TIMEOUT_MS,
  formReadyTimeoutMs: parsed.FORM_READY_TIMEOUT_MS,
  initialFormReadyTimeoutMs: parsed.INITIAL_FORM_READY_TIMEOUT_MS,
  maxConcurrentRuns: parsed.MAX_CONCURRENT_RUNS,
  maxSteps: parsed.MAX_STEPS,
  headless: parsed.HEADLESS
};

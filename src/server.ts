// Load environment before Playwright initializes its browser cache path.
import 'dotenv/config';
import { buildApp } from './app.js';
import { ClaudeDataGenerator, type DataGenerator } from './claude/data-generator.js';
import { DeterministicDataGenerator } from './form/deterministic-data-generator.js';
import { GeminiDataGenerator } from './gemini/data-generator.js';
import { OpenAIDataGenerator } from './openai/data-generator.js';
import { config } from './config.js';
import { JobQueue } from './queue/job-queue.js';
import { FormRunner } from './runner/form-runner.js';
import { RunStore } from './storage/run-store.js';

// ALLOWED_TARGET_HOSTS is optional. When empty, any public HTTP(S) host is
// accepted; private/internal network targets remain blocked by default.
if (!['127.0.0.1', 'localhost', '::1'].includes(config.host) && !config.apiToken) {
  throw new Error('API_TOKEN is required when the service listens on a non-loopback interface.');
}

const store = new RunStore(config.artifactDir);
await store.initialize();
const queue = new JobQueue(config.maxConcurrentRuns);
let generator: DataGenerator;
switch (config.dataGeneratorProvider) {
  case 'openai':
    if (!config.aiApiKey || !config.aiModel) {
      throw new Error('AI_API_KEY and AI_MODEL are required when AI_PROVIDER=openai.');
    }
    generator = new OpenAIDataGenerator(config.aiApiKey, config.aiModel);
    break;
  case 'claude':
    if (!config.aiApiKey || !config.aiModel) {
      throw new Error('AI_API_KEY and AI_MODEL are required when AI_PROVIDER=claude.');
    }
    generator = new ClaudeDataGenerator(config.aiApiKey, config.aiModel);
    break;
  case 'gemini':
    if (!config.aiApiKey || !config.aiModel) {
      throw new Error('AI_API_KEY and AI_MODEL are required when AI_PROVIDER=gemini.');
    }
    generator = new GeminiDataGenerator(config.aiApiKey, config.aiModel);
    break;
  default:
    generator = new DeterministicDataGenerator();
}
console.log(`[mlr-form] data generator provider=${config.dataGeneratorProvider}${config.aiModel ? ` model=${config.aiModel}` : ''}`);
const runner = new FormRunner(store, generator, {
  allowedTargetHosts: config.allowedTargetHosts,
  allowPrivateNetworks: config.allowPrivateNetworks,
  headless: config.headless,
  timeoutMs: config.runTimeoutMs,
  formReadyTimeoutMs: config.formReadyTimeoutMs,
  initialFormReadyTimeoutMs: config.initialFormReadyTimeoutMs
});
const app = await buildApp({
  store,
  queue,
  runner,
  ...(config.apiToken ? { apiToken: config.apiToken } : {}),
  allowedTargetHosts: config.allowedTargetHosts,
  allowPrivateNetworks: config.allowPrivateNetworks,
  maxSteps: config.maxSteps,
  dataGenerator: {
    provider: generator.provider,
    ...(generator.model ? { model: generator.model } : {})
  }
});

const shutdown = async () => {
  await app.close();
  process.exit(0);
};
process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());

await app.listen({ port: config.port, host: config.host });

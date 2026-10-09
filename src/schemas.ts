import { z } from 'zod';

export const createRunSchema = z.object({
  url: z.string().url(),
  scenario: z.string().trim().min(1).max(100).default('generic-form'),
  submit: z.boolean().default(false),
  maxSteps: z.number().int().min(1).max(25).default(10),
  inputMode: z.enum(['automatic', 'excel-steps', 'ai-guided']).default('automatic'),
  payload: z.record(z.string().trim().min(1).max(200), z.string().max(10000)).optional(),
  expectedOutcome: z
    .object({
      urlContains: z.string().min(1).max(500).optional(),
      textContains: z.string().min(1).max(500).optional(),
      selector: z.string().min(1).max(500).optional()
    })
    .optional()
});

export const generatedDataSchema = z.object({
  values: z.array(
    z.object({
      fieldId: z.string().min(1),
      value: z.string()
    })
  )
});

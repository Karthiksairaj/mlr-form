import OpenAI from 'openai';
import { generatedDataSchema } from '../schemas.js';
import type { DataGenerator } from '../claude/data-generator.js';
import type { FormField, GeneratedValue } from '../types.js';

const generatedValuesJsonSchema = {
  type: 'object',
  properties: {
    values: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fieldId: { type: 'string' },
          value: { type: 'string' }
        },
        required: ['fieldId', 'value'],
        additionalProperties: false
      }
    }
  },
  required: ['values'],
  additionalProperties: false
} as const;

export class OpenAIDataGenerator implements DataGenerator {
  readonly provider = 'openai' as const;
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    readonly model: string
  ) {
    this.client = new OpenAI({ apiKey });
  }

  async generate(input: {
    scenario: string;
    fields: FormField[];
    validationErrors?: string[];
  }): Promise<GeneratedValue[]> {
    const response = await this.client.responses.create({
      model: this.model,
      instructions: `You generate synthetic test data for web forms.
Return one value for every interactive field that can be filled.
Use only field IDs supplied by the caller.
Respect type, required, pattern, min/max, length, autocomplete, and select options.
Keep related values internally consistent.
Use fictional names and form.test@abbvie.com for email fields; never use real personal data.
Checkbox and radio values must be "true" or "false" unless supplied options require another value.
Never return browser actions, selectors, explanations, secrets, CAPTCHA solutions, or production identifiers.`,
      input: JSON.stringify(input),
      store: false,
      text: {
        format: {
          type: 'json_schema',
          name: 'generated_form_values',
          strict: true,
          schema: generatedValuesJsonSchema
        }
      }
    });

    if (!response.output_text) {
      throw new Error('OpenAI returned no structured test data.');
    }
    return generatedDataSchema.parse(JSON.parse(response.output_text)).values;
  }
}

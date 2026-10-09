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

export class GeminiDataGenerator implements DataGenerator {
  readonly provider = 'gemini' as const;
  private readonly client: OpenAI;

  constructor(apiKey: string, readonly model: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/'
    });
  }

  async generate(input: {
    scenario: string;
    fields: FormField[];
    validationErrors?: string[];
  }): Promise<GeneratedValue[]> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `You generate synthetic test data for web forms.
Return one value for every interactive field that can be filled.
Use only field IDs supplied by the caller.
Respect type, required, pattern, min/max, length, autocomplete, and select options.
Keep related values internally consistent.
Use fictional names and form.test@abbvie.com for email fields; never use real personal data.
Checkbox and radio values must be "true" or "false" unless supplied options require another value.
Never return browser actions, selectors, explanations, secrets, CAPTCHA solutions, or production identifiers.`
        },
        { role: 'user', content: JSON.stringify(input) }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'generated_form_values',
          strict: true,
          schema: generatedValuesJsonSchema
        }
      }
    });

    const content = completion.choices[0]?.message.content;
    if (!content) throw new Error('Gemini returned no structured test data.');
    return generatedDataSchema.parse(JSON.parse(content)).values;
  }
}

import Anthropic from '@anthropic-ai/sdk';
import { generatedDataSchema } from '../schemas.js';
import type { FormField, GeneratedValue } from '../types.js';

export interface DataGenerator {
  readonly provider: 'local' | 'openai' | 'claude' | 'gemini';
  readonly model?: string;
  generate(input: {
    scenario: string;
    fields: FormField[];
    validationErrors?: string[];
  }): Promise<GeneratedValue[]>;
}

export class ClaudeDataGenerator implements DataGenerator {
  readonly provider = 'claude' as const;
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    readonly model: string
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async generate(input: {
    scenario: string;
    fields: FormField[];
    validationErrors?: string[];
  }): Promise<GeneratedValue[]> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1800,
      temperature: 0,
      system: `You generate synthetic test data for web forms.
Return one value for every interactive field that can be filled.
Use only field IDs supplied by the caller.
Respect type, required, pattern, min/max, length, autocomplete, and select options.
Keep related values internally consistent.
Use fictional names and form.test@abbvie.com for email fields; never use real personal data.
Checkbox and radio values must be "true" or "false" unless supplied options require another value.
Never return browser actions, selectors, explanations, secrets, CAPTCHA solutions, or production identifiers.`,
      messages: [
        {
          role: 'user',
          content: JSON.stringify(input)
        }
      ],
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
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
          }
        }
      }
    });

    const block = response.content.find(item => item.type === 'text');
    if (!block || block.type !== 'text') {
      throw new Error('Claude returned no structured test data.');
    }
    return generatedDataSchema.parse(JSON.parse(block.text)).values;
  }
}

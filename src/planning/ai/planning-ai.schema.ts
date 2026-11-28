import { expenseGroup } from '../../database/schema';

type JsonSchema = Record<string, unknown>;

const expenseSuggestionSchema: JsonSchema = {
  type: 'object',
  properties: {
    description: { type: 'string' },
    group: { type: 'string', enum: expenseGroup.enumValues },
    category: { type: 'string' },
    quantity: { type: 'number' },
    unitPrice: { type: 'number' },
    notes: { type: 'string' },
    reason: { type: 'string' },
  },
  required: [
    'description',
    'group',
    'category',
    'quantity',
    'unitPrice',
    'notes',
    'reason',
  ],
  additionalProperties: false,
};

export const EXPENSE_SUGGESTIONS_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    suggestions: { type: 'array', items: expenseSuggestionSchema },
  },
  required: ['suggestions'],
  additionalProperties: false,
};

import { describe, expect, it } from '@jest/globals';
import { EVENT_AI_DRAFT_FIELDS } from '../dto/event-ai-draft-response.dto';
import { EVENT_AI_DRAFT_SCHEMA } from './event-ai-draft.schema';

type Schema = Record<string, unknown>;

const UNSUPPORTED_KEYWORDS = [
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minLength',
  'maxLength',
  'pattern',
  'minItems',
  'maxItems',
];

function collectSchemas(schema: unknown): Schema[] {
  if (typeof schema !== 'object' || schema === null) return [];
  if (Array.isArray(schema)) return schema.flatMap(collectSchemas);
  const node = schema as Schema;
  return [node, ...Object.values(node).flatMap(collectSchemas)];
}

const objectSchemas = collectSchemas(EVENT_AI_DRAFT_SCHEMA).filter(
  (node) => node.type === 'object',
);

describe('schema do rascunho de evento com IA', () => {
  it('exige todos os campos do DTO e missingFields', () => {
    expect(EVENT_AI_DRAFT_SCHEMA.required).toEqual([
      ...EVENT_AI_DRAFT_FIELDS,
      'missingFields',
    ]);
  });

  it('fecha todos os objetos e exige todas as propriedades', () => {
    expect(objectSchemas.length).toBeGreaterThan(0);
    for (const node of objectSchemas) {
      expect(node.additionalProperties).toBe(false);
      expect(node.required).toEqual(Object.keys(node.properties as Schema));
    }
  });

  it('usa só palavras-chave aceitas pela saída estruturada', () => {
    const keywords = collectSchemas(EVENT_AI_DRAFT_SCHEMA).flatMap(Object.keys);

    for (const keyword of UNSUPPORTED_KEYWORDS) {
      expect(keywords).not.toContain(keyword);
    }
  });
});

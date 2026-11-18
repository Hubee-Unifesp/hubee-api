import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { AiService, AiStructuredRequest } from '../../ai/ai.service';
import { EventAiDraftResponseDto } from '../dto/event-ai-draft-response.dto';
import {
  COMPLETE_DRAFT,
  draftWith,
  FIXTURE_NOW,
  NOT_AN_EVENT_DRAFT,
  PARTIAL_DRAFT,
} from './__fixtures__/event-ai-draft.fixtures';
import { EVENT_AI_DRAFT_SYSTEM_PROMPT } from './event-ai-draft.prompt';
import { EVENT_AI_DRAFT_SCHEMA } from './event-ai-draft.schema';
import { EventAiDraftService } from './event-ai-draft.service';

const generateStructured =
  jest.fn<(request: AiStructuredRequest) => Promise<unknown>>();

function makeService() {
  return new EventAiDraftService({
    generateStructured,
  } as unknown as AiService);
}

async function generateWith(response: unknown, description = 'Show de rock') {
  generateStructured.mockResolvedValue(response);
  return makeService().generate(description, FIXTURE_NOW);
}

describe('EventAiDraftService', () => {
  beforeEach(() => {
    generateStructured.mockReset();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('envia o prompt de sistema, o schema e a descrição com a data atual', async () => {
    await generateWith(COMPLETE_DRAFT.response, COMPLETE_DRAFT.description);

    const request = generateStructured.mock.calls[0][0];
    expect(request.system).toBe(EVENT_AI_DRAFT_SYSTEM_PROMPT);
    expect(request.schema).toBe(EVENT_AI_DRAFT_SCHEMA);
    expect(request.prompt).toContain('2026-11-18 14:00 (quarta-feira)');
    expect(request.prompt).toContain(COMPLETE_DRAFT.description);
  });

  it('devolve o rascunho completo como EventAiDraftResponseDto', async () => {
    const draft = await generateWith(COMPLETE_DRAFT.response);

    expect(draft).toBeInstanceOf(EventAiDraftResponseDto);
    expect({ ...draft }).toEqual(COMPLETE_DRAFT.response);
  });

  it('mantém nulos os campos não inferidos e os lista em missingFields', async () => {
    const draft = await generateWith(PARTIAL_DRAFT.response);

    expect(draft.startDate).toBeNull();
    expect(draft.venueSuggestion).toBeNull();
    expect(draft.suggestedTicketTypes).toEqual([
      { batch: 'Gratuito', price: 0, quantity: null, modality: null },
    ]);
    expect(draft.missingFields).toEqual([
      'ageRating',
      'edition',
      'startDate',
      'endDate',
      'venueSuggestion',
    ]);
  });

  it('aceita o rascunho vazio de um texto que não descreve um evento', async () => {
    const draft = await generateWith(NOT_AN_EVENT_DRAFT.response);

    expect({ ...draft }).toEqual(NOT_AN_EVENT_DRAFT.response);
  });

  it('recalcula missingFields a partir dos campos vazios', async () => {
    const draft = await generateWith(
      draftWith({
        edition: null,
        suggestedTicketTypes: [],
        missingFields: ['name'],
      }),
    );

    expect(draft.missingFields).toEqual(['edition', 'suggestedTicketTypes']);
  });

  it('trata textos em branco como não inferidos', async () => {
    const draft = await generateWith(
      draftWith({
        name: '  ',
        venueSuggestion: { name: '', address: null, city: ' ', state: null },
      }),
    );

    expect(draft.name).toBeNull();
    expect(draft.venueSuggestion).toBeNull();
    expect(draft.missingFields).toEqual(['name', 'venueSuggestion']);
  });

  it('padroniza a UF do local em maiúsculas', async () => {
    const draft = await generateWith(
      draftWith({
        venueSuggestion: {
          name: null,
          address: null,
          city: 'Santos',
          state: 'sp',
        },
      }),
    );

    expect(draft.venueSuggestion).toEqual({
      name: null,
      address: null,
      city: 'Santos',
      state: 'SP',
    });
  });

  it('descarta datas com término anterior ao início', async () => {
    const draft = await generateWith(
      draftWith({
        startDate: '2026-11-21T20:00:00-03:00',
        endDate: '2026-11-21T02:00:00-03:00',
      }),
    );

    expect(draft.startDate).toBeNull();
    expect(draft.endDate).toBeNull();
    expect(draft.missingFields).toEqual(['startDate', 'endDate']);
  });

  it.each([
    ['uma lista', []],
    ['um texto', 'rascunho'],
    ['nulo', null],
    [
      'uma categoria fora de EVENT_CATEGORIES',
      draftWith({ category: 'teatro' }),
    ],
    ['uma classificação inválida', draftWith({ ageRating: '21' })],
    ['uma data fora do ISO 8601', draftWith({ startDate: '21/11/2026 20h' })],
    ['um campo extra', draftWith({ organizerId: 'abc' })],
    [
      'um campo desconhecido em missingFields',
      draftWith({ missingFields: ['venueId'] }),
    ],
    [
      'um lote com preço negativo',
      draftWith({
        suggestedTicketTypes: [
          { batch: 'Pista', price: -10, quantity: null, modality: null },
        ],
      }),
    ],
    [
      'um lote sem nome',
      draftWith({
        suggestedTicketTypes: [
          { batch: '', price: 10, quantity: null, modality: null },
        ],
      }),
    ],
    [
      'um lote com modalidade inválida',
      draftWith({
        suggestedTicketTypes: [
          { batch: 'Pista', price: 10, quantity: null, modality: 'idoso' },
        ],
      }),
    ],
    ['lotes que não são lista', draftWith({ suggestedTicketTypes: null })],
  ])('responde 503 quando a IA devolve %s', async (_case, response) => {
    await expect(generateWith(response)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('não expõe o conteúdo inválido na mensagem de erro', async () => {
    const error = await generateWith(draftWith({ category: 'teatro' })).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as Error).message).not.toContain('teatro');
  });

  it('propaga os erros do provedor de IA', async () => {
    generateStructured.mockRejectedValue(new UnprocessableEntityException());

    await expect(
      makeService().generate('Show de rock', FIXTURE_NOW),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});

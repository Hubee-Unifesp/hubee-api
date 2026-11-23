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
  DATE_WITHOUT_TIME_DRAFT,
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

async function generateWith(
  response: unknown,
  description = 'Show de rock',
  previous?: EventAiDraftResponseDto,
) {
  generateStructured.mockResolvedValue(response);
  return makeService().generate(
    { prompt: description, draft: previous },
    FIXTURE_NOW,
  );
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
    expect({ ...draft }).toEqual({ ...COMPLETE_DRAFT.response, done: true });
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
      'salesStartDate',
      'venueSuggestion',
    ]);
  });

  it('aceita o rascunho vazio de um texto que não descreve um evento', async () => {
    const draft = await generateWith(NOT_AN_EVENT_DRAFT.response);

    expect({ ...draft }).toEqual({
      ...NOT_AN_EVENT_DRAFT.response,
      done: true,
    });
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

  it.each(['São Paulo', 'S.P.', 'SPX'])(
    'anula a UF %s que não é uma sigla de 2 letras',
    async (state) => {
      const draft = await generateWith(
        draftWith({
          venueSuggestion: {
            name: 'Allianz Parque',
            address: null,
            city: 'São Paulo',
            state,
          },
        }),
      );

      expect(draft.venueSuggestion).toEqual({
        name: 'Allianz Parque',
        address: null,
        city: 'São Paulo',
        state: null,
      });
    },
  );

  it('arredonda o preço para 2 casas decimais', async () => {
    const draft = await generateWith(
      draftWith({
        suggestedTicketTypes: [
          {
            batch: 'Inteira',
            price: 25.25,
            quantity: null,
            modality: 'inteira',
          },
          { batch: 'Meia', price: 12.625, quantity: null, modality: 'meia' },
          { batch: 'VIP', price: 33.333333, quantity: null, modality: 'vip' },
        ],
      }),
    );

    expect(
      draft.suggestedTicketTypes.map((ticketType) => ticketType.price),
    ).toEqual([25.25, 12.63, 33.33]);
  });

  it('anula preço e quantidade negativos em vez de descartar o rascunho', async () => {
    const draft = await generateWith(
      draftWith({
        suggestedTicketTypes: [
          { batch: 'Pista', price: -10, quantity: -5, modality: null },
        ],
      }),
    );

    expect(draft.suggestedTicketTypes).toEqual([
      { batch: 'Pista', price: null, quantity: null, modality: null },
    ]);
  });

  it('corta textos longos no limite de cada campo', async () => {
    const draft = await generateWith(
      draftWith({
        name: 'N'.repeat(300),
        edition: 'E'.repeat(150),
        venueSuggestion: {
          name: 'L'.repeat(300),
          address: 'A'.repeat(300),
          city: 'C'.repeat(150),
          state: 'SP',
        },
        suggestedTicketTypes: [
          { batch: 'B'.repeat(150), price: 10, quantity: null, modality: null },
        ],
      }),
    );

    expect(draft.name).toHaveLength(255);
    expect(draft.edition).toHaveLength(100);
    expect(draft.venueSuggestion?.name).toHaveLength(255);
    expect(draft.venueSuggestion?.address).toHaveLength(255);
    expect(draft.venueSuggestion?.city).toHaveLength(100);
    expect(draft.suggestedTicketTypes[0].batch).toHaveLength(100);
    expect(draft.missingFields).toEqual([]);
  });

  it('não parte emojis ao cortar textos longos', async () => {
    const draft = await generateWith(draftWith({ name: '🎉'.repeat(300) }));

    expect(Array.from(draft.name ?? '')).toHaveLength(255);
    expect(draft.name).toBe('🎉'.repeat(255));
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

  it('mantém a data sem horário e a lista em missingFields', async () => {
    const draft = await generateWith(DATE_WITHOUT_TIME_DRAFT.response);

    expect({ ...draft }).toEqual({
      ...DATE_WITHOUT_TIME_DRAFT.response,
      done: false,
    });
  });

  it('aceita término no mesmo dia quando só a data é conhecida', async () => {
    const draft = await generateWith(
      draftWith({ startDate: '2026-11-21', endDate: '2026-11-21' }),
    );

    expect(draft.startDate).toBe('2026-11-21');
    expect(draft.endDate).toBe('2026-11-21');
    expect(draft.missingFields).toEqual(['startDate', 'endDate']);
  });

  it('descarta término em dia anterior ao início quando só a data é conhecida', async () => {
    const draft = await generateWith(
      draftWith({
        startDate: '2026-11-21T20:00:00-03:00',
        endDate: '2026-11-20',
      }),
    );

    expect(draft.startDate).toBeNull();
    expect(draft.endDate).toBeNull();
  });

  it('descarta o início das vendas depois do início do evento', async () => {
    const draft = await generateWith(
      draftWith({
        startDate: '2026-11-21T20:00:00-03:00',
        salesStartDate: '2026-11-22',
      }),
    );

    expect(draft.startDate).toBe('2026-11-21T20:00:00-03:00');
    expect(draft.salesStartDate).toBeNull();
    expect(draft.missingFields).toEqual(['salesStartDate']);
  });

  it('aceita vendas no mesmo dia do evento quando o horário das vendas não é conhecido', async () => {
    const draft = await generateWith(
      draftWith({
        startDate: '2026-11-21T20:00:00-03:00',
        salesStartDate: '2026-11-21',
      }),
    );

    expect(draft.salesStartDate).toBe('2026-11-21');
  });

  it('devolve as perguntas e done falso enquanto houver o que perguntar', async () => {
    const draft = await generateWith(PARTIAL_DRAFT.response);

    expect(draft.questions).toEqual(
      (PARTIAL_DRAFT.response as { questions: unknown }).questions,
    );
    expect(draft.done).toBe(false);
  });

  it('remove perguntas em branco e repetidas para o mesmo campo', async () => {
    const draft = await generateWith(
      draftWith({
        questions: [
          { field: 'startDate', question: '  Que horas começa?  ' },
          { field: 'startDate', question: 'E o dia?' },
          { field: 'venueSuggestion', question: '   ' },
        ],
      }),
    );

    expect(draft.questions).toEqual([
      { field: 'startDate', question: 'Que horas começa?' },
    ]);
  });

  it('limita a lista a 3 perguntas e corta perguntas longas', async () => {
    const draft = await generateWith(
      draftWith({
        questions: [
          { field: 'startDate', question: 'a'.repeat(400) },
          { field: 'endDate', question: 'Término?' },
          { field: 'venueSuggestion', question: 'Local?' },
          { field: 'ageRating', question: 'Classificação?' },
        ],
      }),
    );

    expect(draft.questions.map(({ field }) => field)).toEqual([
      'startDate',
      'endDate',
      'venueSuggestion',
    ]);
    expect(draft.questions[0].question).toHaveLength(300);
  });

  it('envia o rascunho atual e a resposta na rodada seguinte', async () => {
    const previous = {
      ...(DATE_WITHOUT_TIME_DRAFT.response as EventAiDraftResponseDto),
      done: false,
    };

    await generateWith(DATE_WITHOUT_TIME_DRAFT.response, 'às 20h', previous);

    const { prompt } = generateStructured.mock.calls[0][0];
    expect(prompt).toContain('<rascunho_atual>');
    expect(prompt).toContain('"startDate": "2027-01-30"');
    expect(prompt).toContain('Que horas começa a festa?');
    expect(prompt).not.toContain('"done"');
    expect(prompt).not.toContain('"missingFields"');
    expect(prompt).toContain(
      '<descricao_do_organizador>\nàs 20h\n</descricao_do_organizador>',
    );
  });

  it('mantém os valores do rascunho atual que a IA devolveu nulos', async () => {
    const previous = {
      ...(DATE_WITHOUT_TIME_DRAFT.response as EventAiDraftResponseDto),
      done: false,
    };

    const draft = await generateWith(
      {
        ...(NOT_AN_EVENT_DRAFT.response as Record<string, unknown>),
        startDate: '2027-01-30T20:00:00-03:00',
        questions: [{ field: 'endDate', question: 'Que horas termina?' }],
      },
      'às 20h',
      previous,
    );

    expect(draft.name).toBe('Aniversário de 30 anos da Cibelle');
    expect(draft.ageRating).toBe('18');
    expect(draft.startDate).toBe('2027-01-30T20:00:00-03:00');
    expect(draft.salesStartDate).toBe('2026-11-30');
    expect(draft.suggestedTicketTypes).toHaveLength(3);
    expect(draft.missingFields).toEqual([
      'edition',
      'endDate',
      'salesStartDate',
      'venueSuggestion',
    ]);
    expect(draft.questions).toEqual([
      { field: 'endDate', question: 'Que horas termina?' },
    ]);
  });

  it('marca done quando a IA não tem mais perguntas', async () => {
    const draft = await generateWith(draftWith({ questions: [] }));

    expect(draft.done).toBe(true);
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
    [
      'uma data com horário e sem fuso',
      draftWith({ startDate: '2026-11-21T20:00:00' }),
    ],
    ['um dia inexistente', draftWith({ salesStartDate: '2026-02-30' })],
    ['um campo extra', draftWith({ organizerId: 'abc' })],
    [
      'um campo desconhecido em missingFields',
      draftWith({ missingFields: ['venueId'] }),
    ],
    [
      'um lote com preço em texto',
      draftWith({
        suggestedTicketTypes: [
          { batch: 'Pista', price: 'R$ 10', quantity: null, modality: null },
        ],
      }),
    ],
    [
      'uma UF que não é texto',
      draftWith({
        venueSuggestion: { name: null, address: null, city: null, state: 35 },
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
    ['perguntas que não são lista', draftWith({ questions: null })],
    [
      'uma pergunta para um campo desconhecido',
      draftWith({ questions: [{ field: 'coverImage', question: 'Foto?' }] }),
    ],
    ['sem a lista de perguntas', draftWith({ questions: undefined })],
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
      makeService().generate({ prompt: 'Show de rock' }, FIXTURE_NOW),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});

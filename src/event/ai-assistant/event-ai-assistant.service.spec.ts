import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ServiceUnavailableException } from '@nestjs/common';
import type { AiService } from '../../ai/ai.service';
import type { AssistantDraftDto } from './dto/event-ai-assistant.dto';
import { emptyDraft } from './event-ai-assistant.fields';
import { EVENT_AI_ASSISTANT_SCHEMA } from './event-ai-assistant.schema';
import {
  EventAiAssistantService,
  sanitizePatch,
} from './event-ai-assistant.service';

const NOW = new Date('2026-11-24T15:00:00Z');

const NULL_PATCH = {
  name: null,
  description: null,
  category: null,
  ageRating: null,
  edition: null,
  startDate: null,
  startTime: null,
  endDate: null,
  endTime: null,
  salesStartDate: null,
  salesStartTime: null,
  venue: null,
  ticketTypes: null,
  declined: false,
  reply: '',
};

function patch(overrides: Record<string, unknown> = {}) {
  return { ...NULL_PATCH, ...overrides };
}

function draft(overrides: Partial<AssistantDraftDto> = {}): AssistantDraftDto {
  return { ...emptyDraft(), ...overrides };
}

const REQUIRED = {
  name: 'Calourada',
  startDate: '2026-12-05',
  startTime: '20:00',
  endDate: '2026-12-06',
  endTime: '02:00',
  venue: { name: 'Ginásio', address: null, city: 'Santos', state: 'SP' },
};

describe('EventAiAssistantService', () => {
  const generateStructured = jest.fn<AiService['generateStructured']>();
  const service = new EventAiAssistantService({
    generateStructured,
  } as unknown as AiService);

  beforeEach(() => {
    generateStructured.mockReset();
  });

  it('primeira mensagem extrai os dados e pergunta o que falta pela ordem fixa', async () => {
    generateStructured.mockResolvedValue(
      patch({
        name: 'Calourada da Engenharia',
        startDate: '2026-12-05',
        venue: { name: 'Ginásio', address: null, city: null, state: null },
        reply: 'Anotado: Calourada da Engenharia no dia 05/12.',
      }),
    );

    const result = await service.turn(
      { answer: 'Calourada da Engenharia dia 5/12 no Ginásio' },
      NOW,
    );

    expect(generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        schema: EVENT_AI_ASSISTANT_SCHEMA,
        feature: 'event-ai-assistant',
      }),
    );
    expect(result.draft).toMatchObject({
      name: 'Calourada da Engenharia',
      startDate: '2026-12-05',
      startTime: null,
    });
    expect(result.reply).toBe('Anotado: Calourada da Engenharia no dia 05/12.');
    expect(result.question).toEqual({
      field: 'start',
      text: 'Que horas o evento começa no dia 05/12/2026?',
      skippable: false,
    });
    expect(result.missingRequired).toEqual(['start', 'end', 'venue']);
    expect(result.done).toBe(false);
  });

  it('mantém o rascunho anterior e aplica só o que veio na resposta', async () => {
    generateStructured.mockResolvedValue(patch({ startTime: '20:00' }));

    const result = await service.turn(
      {
        draft: draft({ name: 'Calourada', startDate: '2026-12-05' }),
        field: 'start',
        answer: 'às 20h',
      },
      NOW,
    );

    expect(result.draft).toMatchObject({
      name: 'Calourada',
      startDate: '2026-12-05',
      startTime: '20:00',
    });
    expect(result.question?.field).toBe('end');
  });

  it('repete a pergunta quando a resposta não preenche o campo', async () => {
    generateStructured.mockResolvedValue(
      patch({ reply: 'Não encontrei o horário na resposta.' }),
    );

    const result = await service.turn(
      {
        draft: draft({ name: 'Calourada', startDate: '2026-12-05' }),
        field: 'start',
        answer: 'vai ser muito legal',
      },
      NOW,
    );

    expect(result.question?.field).toBe('start');
    expect(result.done).toBe(false);
  });

  it('descarta valores inválidos da IA sem derrubar a rodada', async () => {
    generateStructured.mockResolvedValue(
      patch({
        startDate: '2026-02-31',
        startTime: '25:00',
        category: 'balada',
        name: 'Calourada',
      }),
    );

    const result = await service.turn({ answer: 'Calourada' }, NOW);

    expect(result.draft).toMatchObject({
      name: 'Calourada',
      startDate: null,
      startTime: null,
      category: null,
    });
    expect(result.question?.field).toBe('start');
  });

  it('marca campo opcional como pulado quando o organizador não sabe', async () => {
    generateStructured.mockResolvedValue(patch({ declined: true }));

    const result = await service.turn(
      { draft: draft(REQUIRED), field: 'ticketTypes', answer: 'ainda não sei' },
      NOW,
    );

    expect(result.draft.skipped).toEqual(['ticketTypes']);
    expect(result.question?.field).toBe('salesStart');
  });

  it('não pula campo obrigatório e avisa que ele é necessário', async () => {
    generateStructured.mockResolvedValue(patch({ declined: true }));

    const result = await service.turn(
      {
        draft: draft({ name: 'Calourada' }),
        field: 'start',
        answer: 'não sei',
      },
      NOW,
    );

    expect(result.draft.skipped).toEqual([]);
    expect(result.question?.field).toBe('start');
    expect(result.question?.text).toMatch(/^Esse dado é obrigatório/);
  });

  it('skip pula campo opcional sem chamar a IA', async () => {
    const result = await service.turn(
      { draft: draft(REQUIRED), field: 'ticketTypes', skip: true },
      NOW,
    );

    expect(generateStructured).not.toHaveBeenCalled();
    expect(result.reply).toBeNull();
    expect(result.draft.skipped).toEqual(['ticketTypes']);
  });

  it('só termina quando os obrigatórios estão completos e os opcionais resolvidos', async () => {
    const result = await service.turn(
      {
        draft: draft({
          ...REQUIRED,
          skipped: ['ticketTypes', 'salesStart', 'category', 'ageRating'],
        }),
        field: 'description',
        skip: true,
      },
      NOW,
    );

    expect(result.question).toBeNull();
    expect(result.missingRequired).toEqual([]);
    expect(result.done).toBe(true);
  });

  it('nunca termina com obrigatório vazio, mesmo com tudo pulado', async () => {
    const result = await service.turn(
      {
        draft: draft({
          name: 'Calourada',
          skipped: [
            'ticketTypes',
            'salesStart',
            'category',
            'ageRating',
            'description',
          ],
        }),
        field: 'description',
        skip: true,
      },
      NOW,
    );

    expect(result.done).toBe(false);
    expect(result.question?.field).toBe('start');
  });

  it('apaga término anterior ao início e pergunta de novo com o aviso', async () => {
    generateStructured.mockResolvedValue(
      patch({ endDate: '2026-12-04', endTime: '23:00' }),
    );

    const result = await service.turn(
      {
        draft: draft({
          name: 'Calourada',
          startDate: '2026-12-05',
          startTime: '20:00',
        }),
        field: 'end',
        answer: 'dia 4 às 23h',
      },
      NOW,
    );

    expect(result.draft.endDate).toBeNull();
    expect(result.question?.field).toBe('end');
    expect(result.question?.text).toMatch(/^O término precisa ser depois/);
  });

  it('tira do skipped o campo preenchido depois', async () => {
    generateStructured.mockResolvedValue(patch({ category: 'festas' }));

    const result = await service.turn(
      {
        draft: draft({ ...REQUIRED, skipped: ['category'] }),
        field: 'ticketTypes',
        answer: 'é uma festa, ingressos ainda não',
      },
      NOW,
    );

    expect(result.draft.category).toBe('festas');
    expect(result.draft.skipped).toEqual([]);
  });

  it('não altera o rascunho recebido', async () => {
    generateStructured.mockResolvedValue(patch({ name: 'Outro nome' }));
    const previous = draft({ name: 'Calourada' });

    await service.turn(
      { draft: previous, field: 'name', answer: 'Outro nome' },
      NOW,
    );

    expect(previous.name).toBe('Calourada');
  });

  it('responde 503 quando a IA não devolve um objeto', async () => {
    generateStructured.mockResolvedValue('texto solto');

    await expect(
      service.turn({ answer: 'Calourada' }, NOW),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('sanitizePatch()', () => {
  it('normaliza horário, UF, preço e corta lotes sem nome', () => {
    const { patch: result, dropped } = sanitizePatch(
      patch({
        startTime: '9:30',
        venue: {
          name: ' Ginásio ',
          address: null,
          city: 'Santos',
          state: 'sp',
        },
        ticketTypes: [
          { batch: 'Pista', price: 49.999, quantity: 100, modality: 'vip' },
          { batch: '  ', price: 10, quantity: 1, modality: null },
          { batch: 'Meia', price: -5, quantity: 1.5, modality: 'outra' },
        ],
      }),
    );

    expect(dropped).toEqual([]);
    expect(result.fields).toEqual({
      startTime: '09:30',
      venue: { name: 'Ginásio', address: null, city: 'Santos', state: 'SP' },
      ticketTypes: [
        { batch: 'Pista', price: 50, quantity: 100, modality: 'vip' },
        { batch: 'Meia', price: null, quantity: null, modality: null },
      ],
    });
  });

  it('lista os campos descartados', () => {
    const { patch: result, dropped } = sanitizePatch(
      patch({ ageRating: '21', endDate: '05/12/2026', name: 42 }),
    );

    expect(result.fields).toEqual({});
    expect(dropped).toEqual(['name', 'ageRating', 'endDate']);
  });

  it('ignora lista de lotes vazia e local sem dados', () => {
    const { patch: result } = sanitizePatch(
      patch({
        ticketTypes: [],
        venue: { name: null, address: null, city: null, state: null },
      }),
    );

    expect(result.fields).toEqual({});
  });
});

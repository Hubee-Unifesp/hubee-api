import { describe, expect, it } from '@jest/globals';
import type { AssistantDraftDto } from './dto/event-ai-assistant.dto';
import {
  emptyDraft,
  enforceConsistency,
  isComplete,
  localNow,
  missingRequired,
  nextQuestion,
} from './event-ai-assistant.fields';

const NOW = new Date('2026-11-24T15:00:00Z');

function draft(overrides: Partial<AssistantDraftDto> = {}): AssistantDraftDto {
  return { ...emptyDraft(), ...overrides };
}

const COMPLETE_REQUIRED = {
  name: 'Calourada',
  startDate: '2026-12-05',
  startTime: '20:00',
  endDate: '2026-12-06',
  endTime: '02:00',
  venue: {
    name: 'Ginásio',
    address: null,
    city: 'São José dos Campos',
    state: 'SP',
  },
};

const COMPLETE = draft({
  ...COMPLETE_REQUIRED,
  ticketTypes: [{ batch: '1º lote', price: 30, quantity: 100, modality: null }],
  salesStartDate: '2026-11-30',
  salesStartTime: '10:00',
  category: 'festas',
  ageRating: '18',
  description: 'Festa de recepção dos calouros.',
});

describe('localNow()', () => {
  it('usa o fuso de Brasília', () => {
    expect(localNow(new Date('2026-11-25T02:30:00Z'))).toEqual({
      date: '2026-11-24',
      time: '23:30',
    });
  });
});

describe('isComplete()', () => {
  it('início só fica completo com dia e horário', () => {
    expect(isComplete(draft({ startDate: '2026-12-05' }), 'start')).toBe(false);
    expect(
      isComplete(
        draft({ startDate: '2026-12-05', startTime: '20:00' }),
        'start',
      ),
    ).toBe(true);
  });

  it('local precisa de nome e cidade', () => {
    const venue = { name: 'Ginásio', address: null, city: null, state: null };
    expect(isComplete(draft({ venue }), 'venue')).toBe(false);
    expect(
      isComplete(draft({ venue: { ...venue, city: 'Santos' } }), 'venue'),
    ).toBe(true);
  });

  it('lotes precisam de preço e quantidade em todos', () => {
    const ticketTypes = [
      { batch: 'Pista', price: 50, quantity: 100, modality: null },
      { batch: 'VIP', price: 120, quantity: null, modality: null },
    ];
    expect(isComplete(draft({ ticketTypes }), 'ticketTypes')).toBe(false);
    expect(isComplete(draft({ ticketTypes: [] }), 'ticketTypes')).toBe(false);
    expect(
      isComplete(draft({ ticketTypes: [ticketTypes[0]] }), 'ticketTypes'),
    ).toBe(true);
  });
});

describe('missingRequired()', () => {
  it('lista nome, início, término e local faltando', () => {
    expect(missingRequired(emptyDraft())).toEqual([
      'name',
      'start',
      'end',
      'venue',
    ]);
    expect(missingRequired(draft(COMPLETE_REQUIRED))).toEqual([]);
  });
});

describe('enforceConsistency()', () => {
  it('apaga início no passado', () => {
    const value = draft({ startDate: '2026-11-20', startTime: '20:00' });
    expect(enforceConsistency(value, NOW)).toEqual({ start: 'startInPast' });
    expect(value.startDate).toBeNull();
    expect(value.startTime).toBeNull();
  });

  it('apaga início de hoje num horário que já passou', () => {
    const value = draft({ startDate: '2026-11-24', startTime: '11:00' });
    expect(enforceConsistency(value, NOW)).toEqual({ start: 'startInPast' });
  });

  it('mantém início de hoje mais tarde', () => {
    const value = draft({ startDate: '2026-11-24', startTime: '20:00' });
    expect(enforceConsistency(value, NOW)).toEqual({});
    expect(value.startDate).toBe('2026-11-24');
  });

  it('completa o dia do término no mesmo dia quando o horário é depois do início', () => {
    const value = draft({
      startDate: '2026-12-05',
      startTime: '20:00',
      endTime: '23:00',
    });
    enforceConsistency(value, NOW);
    expect(value.endDate).toBe('2026-12-05');
  });

  it('joga o término de madrugada para o dia seguinte', () => {
    const value = draft({
      startDate: '2026-12-31',
      startTime: '22:00',
      endTime: '04:00',
    });
    enforceConsistency(value, NOW);
    expect(value.endDate).toBe('2027-01-01');
  });

  it('apaga término antes do início', () => {
    const value = draft({
      startDate: '2026-12-05',
      startTime: '20:00',
      endDate: '2026-12-04',
      endTime: '23:00',
    });
    expect(enforceConsistency(value, NOW)).toEqual({ end: 'endBeforeStart' });
    expect(value.endDate).toBeNull();
  });

  it('apaga término igual ao início', () => {
    const value = draft({
      startDate: '2026-12-05',
      startTime: '20:00',
      endDate: '2026-12-05',
      endTime: '20:00',
    });
    expect(enforceConsistency(value, NOW)).toEqual({ end: 'endBeforeStart' });
  });

  it('apaga início das vendas depois do início do evento', () => {
    const value = draft({
      startDate: '2026-12-05',
      startTime: '20:00',
      salesStartDate: '2026-12-06',
      salesStartTime: '10:00',
    });
    expect(enforceConsistency(value, NOW)).toEqual({
      salesStart: 'salesAfterStart',
    });
    expect(value.salesStartDate).toBeNull();
  });
});

describe('nextQuestion()', () => {
  it('começa pelo nome', () => {
    expect(nextQuestion(emptyDraft(), {})).toEqual({
      field: 'name',
      text: 'Qual é o nome do evento?',
      skippable: false,
    });
  });

  it('pergunta só o horário quando o dia já é conhecido', () => {
    const question = nextQuestion(
      draft({ name: 'Calourada', startDate: '2026-12-05' }),
      {},
    );
    expect(question).toMatchObject({ field: 'start', skippable: false });
    expect(question?.text).toBe('Que horas o evento começa no dia 05/12/2026?');
  });

  it('pergunta a cidade quando só o nome do local é conhecido', () => {
    const question = nextQuestion(
      draft({
        ...COMPLETE_REQUIRED,
        venue: { name: 'Bar do Zé', address: null, city: null, state: null },
      }),
      {},
    );
    expect(question?.text).toBe('Em que cidade fica o Bar do Zé?');
  });

  it('pergunta o que falta do lote incompleto', () => {
    const question = nextQuestion(
      draft({
        ...COMPLETE_REQUIRED,
        ticketTypes: [
          { batch: 'Pista', price: 50, quantity: null, modality: null },
        ],
      }),
      {},
    );
    expect(question).toEqual({
      field: 'ticketTypes',
      text: 'Quantos ingressos tem o lote "Pista"?',
      skippable: true,
    });
  });

  it('pula os campos opcionais marcados como pulados', () => {
    const question = nextQuestion(
      draft({ ...COMPLETE_REQUIRED, skipped: ['ticketTypes', 'salesStart'] }),
      {},
    );
    expect(question?.field).toBe('category');
  });

  it('não pula campo obrigatório mesmo marcado', () => {
    expect(nextQuestion(draft({ skipped: ['name'] }), {})?.field).toBe('name');
  });

  it('acrescenta o aviso antes da pergunta', () => {
    const question = nextQuestion(
      draft({ name: 'Calourada', startDate: '2026-12-05', startTime: '20:00' }),
      { end: 'endBeforeStart' },
    );
    expect(question?.text).toBe(
      'O término precisa ser depois do início (05/12/2026 às 20:00). Quando o evento termina? Pode dizer só o horário, se acabar no mesmo dia.',
    );
  });

  it('termina quando tudo está completo', () => {
    expect(nextQuestion(COMPLETE, {})).toBeNull();
  });

  it('termina com os opcionais pulados', () => {
    expect(
      nextQuestion(
        draft({
          ...COMPLETE_REQUIRED,
          skipped: [
            'ticketTypes',
            'salesStart',
            'category',
            'ageRating',
            'description',
          ],
        }),
        {},
      ),
    ).toBeNull();
  });
});

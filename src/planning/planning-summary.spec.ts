import { describe, expect, it } from '@jest/globals';
import {
  allocateAudience,
  planLots,
  calculatePlanningSummary,
  type PlanningExpenseInput,
  type PlanningLotInput,
  sortLotsBySalesOrder,
} from './planning-summary';

const day = (n: number) => new Date(Date.UTC(2026, 9, n));

/** Lotes da planilha Codeniver: 10×45 + 30×48,33 + 40×50 + 85×50 + 105×55 + 30×60. */
const SHEET_LOTS: PlanningLotInput[] = [
  // Fora de ordem de propósito: a função ordena por data de venda e preço.
  {
    id: 'l6',
    batch: '3º Lote',
    price: 60,
    quantity: 30,
    modality: 'inteira' as const,
    salesStartDate: day(6),
  },
  {
    id: 'l1',
    batch: 'Promocional',
    price: 45,
    quantity: 10,
    modality: 'inteira' as const,
    salesStartDate: day(1),
  },
  {
    id: 'l3',
    batch: 'Pré-venda 2',
    price: 50,
    quantity: 40,
    modality: 'inteira' as const,
    salesStartDate: day(3),
  },
  {
    id: 'l2',
    batch: 'Pré-venda 1',
    price: 48.33,
    quantity: 30,
    modality: 'inteira' as const,
    salesStartDate: day(2),
  },
  {
    id: 'l5',
    batch: '2º Lote',
    price: 55,
    quantity: 105,
    modality: 'inteira' as const,
    salesStartDate: day(5),
  },
  {
    id: 'l4',
    batch: '1º Lote',
    price: 50,
    quantity: 85,
    modality: 'inteira' as const,
    salesStartDate: day(4),
  },
];

const expense = (
  overrides: Partial<PlanningExpenseInput> &
    Pick<PlanningExpenseInput, 'group' | 'category' | 'amount'>,
): PlanningExpenseInput => ({
  quoted: true,
  paymentStatus: 'pendente',
  ...overrides,
});

/** Despesas da planilha: fixas 10.010,00 + variáveis e marketing 5.493,94. */
const SHEET_EXPENSES: PlanningExpenseInput[] = [
  expense({
    group: 'fixed',
    category: 'Estrutura',
    amount: 5000,
    paymentStatus: 'pago',
  }),
  expense({ group: 'fixed', category: 'Estrutura', amount: 3040 }),
  expense({ group: 'fixed', category: 'Staff', amount: 1970, quoted: false }),
  expense({
    group: 'variable',
    category: 'Open',
    amount: 4803.47,
    paymentStatus: 'atrasado',
  }),
  expense({
    group: 'marketing',
    category: 'MKT',
    amount: 690.47,
    quoted: false,
  }),
  expense({
    group: 'marketing',
    category: 'Brindes',
    amount: 0,
    quoted: false,
  }),
  // Cancelado fica fora de todos os totais e contagens.
  expense({
    group: 'fixed',
    category: 'Estrutura',
    amount: 9999,
    quoted: false,
    paymentStatus: 'cancelado',
  }),
];

describe('calculatePlanningSummary (GOL-297)', () => {
  describe('números da planilha', () => {
    const summary = calculatePlanningSummary({
      expenses: SHEET_EXPENSES,
      lots: SHEET_LOTS,
      audience: 300,
    });

    it('calcula o resultado para o público de 300', () => {
      expect(summary.result).toEqual({
        audience: 300,
        revenue: 15724.9,
        averageTicket: 52.42,
        breakEven: 295.78,
        costPerPerson: 51.68,
        profit: 220.96,
        breakEvenBatch: '3º Lote',
      });
    });

    it('com público de 320 o excedente entra no último lote e o lucro vai a 1.420,96', () => {
      const at320 = calculatePlanningSummary({
        expenses: SHEET_EXPENSES,
        lots: SHEET_LOTS,
        audience: 320,
      });
      expect(at320.result.revenue).toBe(16924.9);
      expect(at320.result.profit).toBe(1420.96);
    });

    it('resume as despesas sem os itens cancelados', () => {
      expect(summary.expenses).toEqual({
        total: 15503.94,
        byGroup: { fixed: 10010, variable: 4803.47, marketing: 690.47 },
        paidTotal: 5000,
        pendingTotal: 10503.94,
        itemCount: 6,
        quotedCount: 3,
      });
    });

    it('ordena byCategory do maior para o menor total, começando por Estrutura e Open', () => {
      expect(summary.byCategory).toEqual([
        { category: 'Estrutura', group: 'fixed', total: 8040 },
        { category: 'Open', group: 'variable', total: 4803.47 },
        { category: 'Staff', group: 'fixed', total: 1970 },
        { category: 'MKT', group: 'marketing', total: 690.47 },
        { category: 'Brindes', group: 'marketing', total: 0 },
      ]);
    });

    it('conta como "a pagar" só itens com valor > 0 e não pagos', () => {
      expect(summary.pending).toEqual({ toPay: 4, notQuoted: 3 });
    });

    it('lista os lotes na ordem de venda com a faixa de ingressos de cada um', () => {
      expect(summary.tickets.planned).toBe(300);
      expect(
        summary.tickets.lots.map(({ batch, start, end }) => [
          batch,
          start,
          end,
        ]),
      ).toEqual([
        ['Promocional', 1, 10],
        ['Pré-venda 1', 11, 40],
        ['Pré-venda 2', 41, 80],
        ['1º Lote', 81, 165],
        ['2º Lote', 166, 270],
        ['3º Lote', 271, 300],
      ]);
    });

    it('gera os cenários de −40 a +40 pessoas', () => {
      expect(
        summary.scenarios.map(({ audience, profit }) => [audience, profit]),
      ).toEqual([
        // 260: tira 30 do 3º Lote (60) e 10 do 2º Lote (55).
        [260, -2129.04],
        // 280: tira 20 do 3º Lote.
        [280, -979.04],
        [300, 220.96],
        [320, 1420.96],
        [340, 2620.96],
      ]);
      expect(summary.scenarios[2]).toEqual(summary.result);
    });
  });

  describe('público abaixo do planejado', () => {
    it('sai dos últimos lotes primeiro e deixa os lotes vazios sem faixa', () => {
      const summary = calculatePlanningSummary({
        expenses: [],
        lots: SHEET_LOTS,
        audience: 50,
      });

      expect(
        summary.tickets.lots.map(({ batch, start, end }) => [
          batch,
          start,
          end,
        ]),
      ).toEqual([
        ['Promocional', 1, 10],
        ['Pré-venda 1', 11, 40],
        ['Pré-venda 2', 41, 50],
        ['1º Lote', null, null],
        ['2º Lote', null, null],
        ['3º Lote', null, null],
      ]);
      expect(summary.result.revenue).toBe(450 + 1449.9 + 500);
    });

    it('não gera cenários com público ≤ 0', () => {
      const summary = calculatePlanningSummary({
        expenses: [],
        lots: SHEET_LOTS,
        audience: 30,
      });
      expect(summary.scenarios.map((s) => s.audience)).toEqual([
        10, 30, 50, 70,
      ]);
    });
  });

  describe('casos sem dados', () => {
    it('sem público, os campos dependentes vêm null e não há cenários', () => {
      const summary = calculatePlanningSummary({
        expenses: SHEET_EXPENSES,
        lots: SHEET_LOTS,
        audience: null,
      });

      expect(summary.result).toEqual({
        audience: null,
        revenue: null,
        averageTicket: null,
        breakEven: null,
        costPerPerson: null,
        profit: null,
        breakEvenBatch: null,
      });
      expect(summary.scenarios).toEqual([]);
      expect(summary.tickets.planned).toBe(300);
      expect(summary.tickets.lots.every((l) => l.start === null)).toBe(true);
    });

    it('sem lotes, só o custo por pessoa é calculado', () => {
      const summary = calculatePlanningSummary({
        expenses: SHEET_EXPENSES,
        lots: [],
        audience: 300,
      });

      expect(summary.tickets).toEqual({ planned: 0, lots: [] });
      expect(summary.result).toEqual({
        audience: 300,
        revenue: null,
        averageTicket: null,
        breakEven: null,
        costPerPerson: 51.68,
        profit: null,
        breakEvenBatch: null,
      });
    });

    it('com lotes gratuitos não divide por zero no break-even', () => {
      const summary = calculatePlanningSummary({
        expenses: SHEET_EXPENSES,
        lots: [
          {
            id: 'c',
            batch: 'Cortesia',
            price: 0,
            quantity: 100,
            modality: 'cortesia' as const,
            salesStartDate: null,
          },
        ],
        audience: 100,
      });

      expect(summary.result).toMatchObject({
        revenue: 0,
        averageTicket: 0,
        breakEven: null,
        profit: -15503.94,
        breakEvenBatch: null,
      });
    });

    it('sem despesas o break-even é zero e não aponta lote', () => {
      const summary = calculatePlanningSummary({
        expenses: [],
        lots: SHEET_LOTS,
        audience: 300,
      });

      expect(summary.expenses.total).toBe(0);
      expect(summary.byCategory).toEqual([]);
      expect(summary.result).toMatchObject({
        breakEven: 0,
        costPerPerson: 0,
        profit: 15724.9,
        breakEvenBatch: null,
      });
    });
  });

  describe('helpers', () => {
    it('ordena por data de venda (sem data por último), depois preço', () => {
      const sorted = sortLotsBySalesOrder([
        {
          id: 'a',
          batch: 'Sem data caro',
          price: 80,
          quantity: 1,
          modality: 'inteira' as const,
          salesStartDate: null,
        },
        {
          id: 'b',
          batch: 'Sem data barato',
          price: 20,
          quantity: 1,
          modality: 'inteira' as const,
          salesStartDate: null,
        },
        {
          id: 'c',
          batch: 'Datado',
          price: 100,
          quantity: 1,
          modality: 'inteira' as const,
          salesStartDate: day(1),
        },
      ]);
      expect(sorted.map((l) => l.batch)).toEqual([
        'Datado',
        'Sem data barato',
        'Sem data caro',
      ]);
    });

    it('break-even acima do planejado aponta para o último lote', () => {
      const summary = calculatePlanningSummary({
        expenses: [
          expense({ group: 'fixed', category: 'Estrutura', amount: 1000 }),
        ],
        lots: [
          {
            id: 'a',
            batch: 'Único',
            price: 10,
            quantity: 50,
            modality: 'inteira' as const,
            salesStartDate: null,
          },
          {
            id: 'b',
            batch: 'Final',
            price: 10,
            quantity: 10,
            modality: 'inteira' as const,
            salesStartDate: null,
          },
        ],
        audience: 60,
      });
      expect(summary.result).toMatchObject({
        breakEven: 100,
        breakEvenBatch: 'Final',
      });
    });

    it('allocateAudience coloca o excedente no último lote', () => {
      expect(allocateAudience(planLots(SHEET_LOTS), 320)).toEqual([
        10, 30, 40, 85, 105, 50,
      ]);
    });
  });
  describe('modalidades em paralelo (meia, estudante, vip e cortesia)', () => {
    const paidWithCourtesy = (audience: number) =>
      calculatePlanningSummary({
        expenses: SHEET_EXPENSES,
        lots: [
          ...SHEET_LOTS,
          // Sem data e de R$ 0: antes vinha primeiro na ordem de venda e
          // consumia os 100 primeiros ingressos da fila.
          {
            id: 'c',
            batch: 'Cortesia',
            price: 0,
            quantity: 100,
            modality: 'cortesia' as const,
            salesStartDate: null,
          },
        ],
        audience,
      });

    it('cortesia entra como público sem receita e não desloca a fila de venda', () => {
      const summary = paidWithCourtesy(400);

      expect(summary.tickets.planned).toBe(400);
      expect(
        summary.tickets.lots.map(({ batch, sequential, start, end }) => [
          batch,
          sequential,
          start,
          end,
        ]),
      ).toEqual([
        ['Promocional', true, 1, 10],
        ['Pré-venda 1', true, 11, 40],
        ['Pré-venda 2', true, 41, 80],
        ['1º Lote', true, 81, 165],
        ['2º Lote', true, 166, 270],
        ['3º Lote', true, 271, 300],
        ['Cortesia', false, 301, 400],
      ]);
      // A mesma receita da planilha, agora dividida por 400 pessoas.
      expect(summary.result).toEqual({
        audience: 400,
        revenue: 15724.9,
        averageTicket: 39.31,
        breakEven: 394.38,
        costPerPerson: 38.76,
        profit: 220.96,
        breakEvenBatch: '3º Lote',
      });
    });

    it('abaixo do planejado o público sai da fila antes das cotas', () => {
      const summary = paidWithCourtesy(150);

      expect(
        summary.tickets.lots
          .filter(({ start }) => start !== null)
          .map(({ batch, start, end }) => [batch, start, end]),
      ).toEqual([
        ['Promocional', 1, 10],
        ['Pré-venda 1', 11, 40],
        ['Pré-venda 2', 41, 50],
        ['Cortesia', 51, 150],
      ]);
      expect(summary.result.revenue).toBe(450 + 1449.9 + 500);
    });

    it('meia paga entra na receita antes da fila e antecipa o lote do empate', () => {
      const summary = calculatePlanningSummary({
        expenses: [
          expense({ group: 'fixed', category: 'Estrutura', amount: 1000 }),
        ],
        lots: [
          {
            id: 'a',
            batch: '1º Lote',
            price: 20,
            quantity: 30,
            modality: 'inteira' as const,
            salesStartDate: day(1),
          },
          {
            id: 'b',
            batch: '2º Lote',
            price: 30,
            quantity: 30,
            modality: 'inteira' as const,
            salesStartDate: day(2),
          },
          {
            id: 'm',
            batch: 'Meia',
            price: 10,
            quantity: 20,
            modality: 'meia' as const,
            salesStartDate: day(1),
          },
        ],
        audience: 80,
      });

      // Meia 200 + 1º Lote 600 = 800 < 1000: o empate sai no 2º Lote.
      expect(summary.result).toMatchObject({
        revenue: 200 + 600 + 900,
        breakEvenBatch: '2º Lote',
      });
      expect(summary.tickets.lots.map((l) => l.batch)).toEqual([
        '1º Lote',
        '2º Lote',
        'Meia',
      ]);
    });

    it('sem lote inteira, todos os lotes formam a fila', () => {
      const summary = calculatePlanningSummary({
        expenses: [],
        lots: [
          {
            id: 'e',
            batch: 'Estudante',
            price: 25,
            quantity: 10,
            modality: 'estudante' as const,
            salesStartDate: null,
          },
        ],
        audience: 15,
      });

      expect(summary.tickets.lots[0]).toMatchObject({
        sequential: true,
        start: 1,
        end: 15,
      });
      expect(summary.result.revenue).toBe(375);
    });
  });
});

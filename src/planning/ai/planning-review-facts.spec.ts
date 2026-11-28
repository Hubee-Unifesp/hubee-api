import { describe, expect, it } from '@jest/globals';
import { SHEET_EXPENSES, SHEET_LOTS } from '../planning-sheet.fixtures';
import {
  calculatePlanningReviewFacts,
  daysBetween,
  type ReviewExpenseInput,
} from './planning-review-facts';

const NOW = new Date('2026-11-20T15:00:00Z');
const START = new Date('2026-12-05T23:00:00Z');

/** Despesas da planilha Codeniver com id, descrição e vencimento. */
const EXPENSES: ReviewExpenseInput[] = SHEET_EXPENSES.map((expense, index) => ({
  ...expense,
  id: `d${index + 1}`,
  description: `${expense.category} ${index + 1}`,
  dueDate: null,
}));

const facts = (
  overrides: Partial<Parameters<typeof calculatePlanningReviewFacts>[0]> = {},
) =>
  calculatePlanningReviewFacts({
    startDate: START,
    expectedAudience: 300,
    expenses: EXPENSES,
    installments: [],
    lots: SHEET_LOTS,
    now: NOW,
    ...overrides,
  });

describe('calculatePlanningReviewFacts (GOL-307)', () => {
  it('reaproveita o resumo financeiro da planilha para o público esperado', () => {
    const result = facts();

    expect(result.expenses).toEqual({
      total: 15503.94,
      byGroup: { fixed: 10010, variable: 4803.47, marketing: 690.47 },
      paidTotal: 5000,
      pendingTotal: 10503.94,
      itemCount: 6,
    });
    expect(result.result).toMatchObject({
      audience: 300,
      breakEven: 295.78,
      profit: 220.96,
      breakEvenBatch: '3º Lote',
    });
    expect(result.plannedTickets).toBe(300);
    expect(result.resultAtPlannedTickets.profit).toBe(220.96);
    expect(result.breakEvenAboveExpectedAudience).toBe(false);
    expect(result.breakEvenAbovePlannedTickets).toBe(false);
  });

  it('conta os dias de calendário até o evento no fuso de São Paulo', () => {
    expect(facts().daysUntilEvent).toBe(15);
    expect(daysBetween(new Date('2026-12-06T02:00:00Z'), START)).toBe(0);
    expect(daysBetween(new Date('2026-12-07T12:00:00Z'), START)).toBe(-2);
  });

  it('marca o break-even acima do público esperado', () => {
    const result = facts({ expectedAudience: 280 });

    expect(result.result.profit).toBe(-979.04);
    expect(result.breakEvenAboveExpectedAudience).toBe(true);
  });

  it('lista os itens sem cotação do maior para o menor, sem os cancelados', () => {
    const { notQuoted } = facts();

    expect(notQuoted.count).toBe(3);
    expect(notQuoted.total).toBe(2660.47);
    expect(notQuoted.items.map((item) => [item.id, item.amount])).toEqual([
      ['d3', 1970],
      ['d5', 690.47],
      ['d6', 0],
    ]);
  });

  it('acha pagamentos vencidos pela despesa ou pelas parcelas pendentes', () => {
    const expenses = EXPENSES.map((expense) =>
      expense.id === 'd3'
        ? { ...expense, dueDate: new Date('2026-11-10T12:00:00Z') }
        : expense.id === 'd5'
          ? { ...expense, dueDate: new Date('2026-11-25T12:00:00Z') }
          : expense,
    );
    const { overdue } = facts({
      expenses,
      installments: [
        {
          expenseId: 'd2',
          amount: 1000,
          dueDate: new Date('2026-11-01T12:00:00Z'),
          status: 'pendente',
        },
        {
          expenseId: 'd2',
          amount: 2040,
          dueDate: new Date('2026-12-01T12:00:00Z'),
          status: 'pendente',
        },
        {
          expenseId: 'd1',
          amount: 5000,
          dueDate: new Date('2026-11-01T12:00:00Z'),
          status: 'pendente',
        },
      ],
    });

    // d4 está "atrasado"; d3 venceu; d2 tem uma parcela vencida; d1 já foi paga;
    // d5 vence depois de hoje; d7 está cancelada.
    expect(overdue.items.map((item) => [item.id, item.overdueAmount])).toEqual([
      ['d4', 4803.47],
      ['d2', 1000],
      ['d3', 1970],
    ]);
    expect(overdue.count).toBe(3);
    expect(overdue.total).toBe(7773.47);
  });

  it('traz as 3 maiores categorias com a fração do total', () => {
    expect(facts().topCategories).toEqual([
      { category: 'Estrutura', group: 'fixed', total: 8040, share: 0.5186 },
      { category: 'Open', group: 'variable', total: 4803.47, share: 0.3098 },
      { category: 'Staff', group: 'fixed', total: 1970, share: 0.1271 },
    ]);
  });

  it('sem despesas, lotes nem público responde com zeros e sem break-even', () => {
    const result = facts({ expenses: [], lots: [], expectedAudience: null });

    expect(result.expenses.total).toBe(0);
    expect(result.plannedTickets).toBe(0);
    expect(result.result.breakEven).toBeNull();
    expect(result.breakEvenAboveExpectedAudience).toBe(false);
    expect(result.topCategories).toEqual([]);
  });
});

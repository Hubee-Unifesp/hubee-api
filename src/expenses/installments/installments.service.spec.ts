import { describe, expect, it } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { ensureWithinExpenseAmount } from './installments.service';

describe('ensureWithinExpenseAmount', () => {
  it('aceita parcelas que somam exatamente o valor da despesa', () => {
    expect(() =>
      ensureWithinExpenseAmount(1000, 400, 600, 'pendente'),
    ).not.toThrow();
    expect(() =>
      ensureWithinExpenseAmount(0.3, 0.1, 0.2, 'pago'),
    ).not.toThrow();
  });

  it('recusa quando a soma passa do valor da despesa e informa o disponível', () => {
    expect(() => ensureWithinExpenseAmount(1000, 400, 600.01, 'pago')).toThrow(
      new BadRequestException(
        'A soma das parcelas não pode passar do valor da despesa. Valor disponível: R$ 600,00.',
      ),
    );
  });

  it('ignora parcela cancelada', () => {
    expect(() =>
      ensureWithinExpenseAmount(1000, 1000, 500, 'cancelado'),
    ).not.toThrow();
  });
});

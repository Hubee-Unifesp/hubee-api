import { describe, expect, it } from '@jest/globals';
import {
  PENDING_ORDER_TTL_MINUTES,
  isReservationExpired,
  pendingReservationCutoff,
  reservationExpiresAt,
} from './order-reservation';

const MINUTE = 60 * 1000;
const now = new Date('2026-11-07T12:00:00Z');
const minutesAgo = (minutes: number) =>
  new Date(now.getTime() - minutes * MINUTE);

describe('order-reservation', () => {
  it('a reserva vence PENDING_ORDER_TTL_MINUTES depois da criação do pedido', () => {
    const createdAt = minutesAgo(0);

    expect(reservationExpiresAt({ createdAt }).getTime()).toBe(
      createdAt.getTime() + PENDING_ORDER_TTL_MINUTES * MINUTE,
    );
  });

  it('o corte das reservas válidas fica PENDING_ORDER_TTL_MINUTES antes de agora', () => {
    expect(pendingReservationCutoff(now)).toEqual(
      minutesAgo(PENDING_ORDER_TTL_MINUTES),
    );
  });

  describe('isReservationExpired()', () => {
    it('pedido pendente dentro do prazo não expirou', () => {
      expect(
        isReservationExpired(
          {
            status: 'pendente',
            createdAt: minutesAgo(PENDING_ORDER_TTL_MINUTES - 1),
          },
          now,
        ),
      ).toBe(false);
    });

    it('pedido pendente expira exatamente no fim do prazo', () => {
      expect(
        isReservationExpired(
          {
            status: 'pendente',
            createdAt: minutesAgo(PENDING_ORDER_TTL_MINUTES),
          },
          now,
        ),
      ).toBe(true);
    });

    it('pedido pendente depois do prazo expirou', () => {
      expect(
        isReservationExpired(
          { status: 'pendente', createdAt: minutesAgo(60 * 24) },
          now,
        ),
      ).toBe(true);
    });

    it.each(['pago', 'cancelado'])(
      'pedido %s nunca expira, mesmo antigo',
      (status) => {
        expect(
          isReservationExpired({ status, createdAt: minutesAgo(60 * 24) }, now),
        ).toBe(false);
      },
    );
  });
});

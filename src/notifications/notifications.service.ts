import { Injectable, NotFoundException } from '@nestjs/common';
import type { DbExecutor } from '../database/database.provider';
import { sumCommittedByTicketType } from '../order/order-reservation';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { NotificationsRepository } from './notifications.repository';

export interface PaidOrderNotificationItem {
  ticketTypeId: string;
  quantity: number;
  ticketType?: {
    id?: string;
    eventId: string;
    batch?: string;
    quantity?: number;
  } | null;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
  ) {}

  async findAllForUser(userId: string, query: QueryNotificationsDto = {}) {
    const [data, unreadCount] = await Promise.all([
      this.notificationsRepository.findAllByUser(userId, {
        unreadOnly: query.unreadOnly,
      }),
      this.notificationsRepository.countUnreadByUser(userId),
    ]);

    return { data, unreadCount };
  }

  async markAsRead(id: string, userId: string) {
    const notification = await this.notificationsRepository.markAsRead(
      id,
      userId,
    );
    if (!notification) {
      throw new NotFoundException(`Notificação ${id} não encontrada`);
    }
    return notification;
  }

  async markAllAsRead(userId: string) {
    const updatedCount =
      await this.notificationsRepository.markAllAsRead(userId);
    return { updatedCount };
  }

  /**
   * Dispara notificações quando um pagamento é confirmado no checkout:
   * 1. Para o comprador (`payment_confirmed`)
   * 2. Para os membros da organização do evento (`new_sale`)
   * 3. Se algum lote comprado esgotou (`batch_sold_out`), notifica a organização
   */
  async notifyPaymentConfirmed(
    order: { id: string; userId: string },
    items: PaidOrderNotificationItem[],
    executor?: DbExecutor,
  ): Promise<void> {
    const eventIds = [
      ...new Set(
        items
          .map((item) => item.ticketType?.eventId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const events = await this.notificationsRepository.findEventsByIds(
      eventIds,
      executor,
    );
    const eventsById = new Map(events.map((event) => [event.id, event]));
    const firstEvent = events[0];

    const toCreate: Parameters<NotificationsRepository['createMany']>[0] = [
      {
        userId: order.userId,
        type: 'payment_confirmed',
        title: 'Pagamento confirmado',
        message: firstEvent
          ? `Seu pagamento foi aprovado e seus ingressos para o evento "${firstEvent.name}" já estão disponíveis.`
          : 'Seu pagamento foi aprovado e seus ingressos já estão disponíveis.',
        href: '/conta/ingressos',
      },
    ];

    const organizerIds = events.map((event) => event.organizerId);
    const membersByOrg =
      await this.notificationsRepository.findAcceptedOrganizationMembers(
        organizerIds,
        executor,
      );

    // Soma ingressos vendidos por evento neste pedido
    const ticketsByEvent = new Map<string, number>();
    for (const item of items) {
      const eventId = item.ticketType?.eventId;
      if (!eventId) continue;
      ticketsByEvent.set(
        eventId,
        (ticketsByEvent.get(eventId) ?? 0) + item.quantity,
      );
    }

    for (const [eventId, totalSold] of ticketsByEvent) {
      const event = eventsById.get(eventId);
      if (!event) continue;
      const memberIds = membersByOrg.get(event.organizerId) ?? [];
      for (const memberId of memberIds) {
        toCreate.push({
          userId: memberId,
          type: 'new_sale',
          title: 'Nova venda confirmada',
          message: `Nova venda de ${totalSold} ingresso(s) confirmada para o evento "${event.name}".`,
          href: `/organizador/eventos/${event.id}`,
        });
      }
    }

    // Verifica se algum lote comprado esgotou após a confirmação
    const lotsWithCapacity = items
      .map((item) => item.ticketType)
      .filter(
        (
          lot,
        ): lot is {
          id?: string;
          eventId: string;
          batch: string;
          quantity: number;
        } =>
          Boolean(
            lot &&
              typeof lot.quantity === 'number' &&
              typeof lot.batch === 'string',
          ),
      );

    if (lotsWithCapacity.length > 0 && executor) {
      const ticketTypeIds = [
        ...new Set(items.map((item) => item.ticketTypeId)),
      ];
      const committed = await sumCommittedByTicketType(executor, ticketTypeIds);
      const notifiedLots = new Set<string>();

      for (const item of items) {
        if (notifiedLots.has(item.ticketTypeId)) continue;
        notifiedLots.add(item.ticketTypeId);

        const lot = item.ticketType;
        if (
          !lot ||
          typeof lot.quantity !== 'number' ||
          typeof lot.batch !== 'string'
        ) {
          continue;
        }

        const used = committed.get(item.ticketTypeId) ?? 0;
        if (lot.quantity - used <= 0) {
          const event = eventsById.get(lot.eventId);
          if (!event) continue;
          const memberIds = membersByOrg.get(event.organizerId) ?? [];
          for (const memberId of memberIds) {
            toCreate.push({
              userId: memberId,
              type: 'batch_sold_out',
              title: 'Lote esgotado',
              message: `O lote "${lot.batch}" do evento "${event.name}" esgotou.`,
              href: `/organizador/eventos/${event.id}`,
            });
          }
        }
      }
    }

    await this.notificationsRepository.createMany(toCreate, executor);
  }

  /** Dispara notificação para o comprador quando um pedido é cancelado. */
  async notifyOrderCancelled(
    order: { id: string; userId: string },
    executor?: DbExecutor,
  ): Promise<void> {
    await this.notificationsRepository.create(
      {
        userId: order.userId,
        type: 'order_cancelled',
        title: 'Pedido cancelado',
        message: 'Seu pedido foi cancelado e a reserva de ingressos encerrada.',
        href: '/conta/pedidos',
      },
      executor,
    );
  }

  /** Dispara notificação para o comprador quando um pagamento é estornado. */
  async notifyOrderRefunded(
    order: { id: string; userId: string },
    executor?: DbExecutor,
  ): Promise<void> {
    await this.notificationsRepository.create(
      {
        userId: order.userId,
        type: 'order_refunded',
        title: 'Pagamento estornado',
        message:
          'O pagamento do seu pedido foi estornado e os ingressos vinculados foram cancelados.',
        href: '/conta/pedidos',
      },
      executor,
    );
  }

  /**
   * Dispara notificação para todos os compradores/titulares com ingressos ativos
   * quando um evento é cancelado.
   */
  async notifyEventCancelled(
    event: { id: string; name: string },
    executor?: DbExecutor,
  ): Promise<void> {
    const affectedUserIds =
      await this.notificationsRepository.findAffectedUsersByEvent(
        event.id,
        executor,
      );
    if (affectedUserIds.length === 0) return;

    await this.notificationsRepository.createMany(
      affectedUserIds.map((userId) => ({
        userId,
        type: 'event_cancelled' as const,
        title: 'Evento cancelado',
        message: `O evento "${event.name}" foi cancelado pelo organizador.`,
        href: '/conta/pedidos',
      })),
      executor,
    );
  }
}

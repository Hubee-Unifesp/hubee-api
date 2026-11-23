import { Injectable, NotFoundException } from '@nestjs/common';
import type { DbExecutor } from '../database/database.provider';
import {
  DEFAULT_NOTIFICATIONS_LIMIT,
  QueryNotificationsDto,
} from './dto/query-notifications.dto';
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
        limit: query.limit ?? DEFAULT_NOTIFICATIONS_LIMIT,
        offset: query.offset ?? 0,
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

    const ticketsByEvent = new Map<string, number>();
    const boughtByLot = new Map<string, number>();
    const lotById = new Map<
      string,
      { eventId: string; batch: string; quantity: number }
    >();

    for (const item of items) {
      const eventId = item.ticketType?.eventId;
      if (eventId) {
        ticketsByEvent.set(
          eventId,
          (ticketsByEvent.get(eventId) ?? 0) + item.quantity,
        );
      }

      boughtByLot.set(
        item.ticketTypeId,
        (boughtByLot.get(item.ticketTypeId) ?? 0) + item.quantity,
      );

      const lot = item.ticketType;
      if (
        lot &&
        typeof lot.quantity === 'number' &&
        typeof lot.batch === 'string'
      ) {
        lotById.set(item.ticketTypeId, {
          eventId: lot.eventId,
          batch: lot.batch,
          quantity: lot.quantity,
        });
      }
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

    if (lotById.size > 0) {
      const soldByLot = await this.notificationsRepository.sumSoldByTicketType(
        [...lotById.keys()],
        executor,
      );

      for (const [ticketTypeId, lot] of lotById) {
        const sold = soldByLot.get(ticketTypeId) ?? 0;
        const boughtNow = boughtByLot.get(ticketTypeId) ?? 0;
        const soldBefore = sold - boughtNow;

        if (lot.quantity - soldBefore > 0 && lot.quantity - sold <= 0) {
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

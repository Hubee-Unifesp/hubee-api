import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { notifications } from '../database/schema';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';

type Notification = typeof notifications.$inferSelect;

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'notif-1',
    userId: 'user-1',
    type: 'payment_confirmed',
    title: 'Pagamento confirmado',
    message: 'Ingressos emitidos.',
    href: '/conta/ingressos',
    readAt: null,
    createdAt: new Date('2026-11-22T01:00:00Z'),
    ...overrides,
  };
}

describe('NotificationsService', () => {
  let service: NotificationsService;
  let repository: {
    findAllByUser: jest.Mock<NotificationsRepository['findAllByUser']>;
    countUnreadByUser: jest.Mock<NotificationsRepository['countUnreadByUser']>;
    markAsRead: jest.Mock<NotificationsRepository['markAsRead']>;
    markAllAsRead: jest.Mock<NotificationsRepository['markAllAsRead']>;
    create: jest.Mock<NotificationsRepository['create']>;
    createMany: jest.Mock<NotificationsRepository['createMany']>;
    findAcceptedOrganizationMembers: jest.Mock<
      NotificationsRepository['findAcceptedOrganizationMembers']
    >;
    findEventsByIds: jest.Mock<NotificationsRepository['findEventsByIds']>;
    findAffectedUsersByEvent: jest.Mock<
      NotificationsRepository['findAffectedUsersByEvent']
    >;
  };

  beforeEach(async () => {
    repository = {
      findAllByUser: jest.fn<NotificationsRepository['findAllByUser']>(),
      countUnreadByUser:
        jest.fn<NotificationsRepository['countUnreadByUser']>(),
      markAsRead: jest.fn<NotificationsRepository['markAsRead']>(),
      markAllAsRead: jest.fn<NotificationsRepository['markAllAsRead']>(),
      create: jest.fn<NotificationsRepository['create']>(),
      createMany: jest.fn<NotificationsRepository['createMany']>(),
      findAcceptedOrganizationMembers:
        jest.fn<NotificationsRepository['findAcceptedOrganizationMembers']>(),
      findEventsByIds: jest.fn<NotificationsRepository['findEventsByIds']>(),
      findAffectedUsersByEvent:
        jest.fn<NotificationsRepository['findAffectedUsersByEvent']>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: NotificationsRepository, useValue: repository },
      ],
    }).compile();

    service = module.get(NotificationsService);
  });

  describe('findAllForUser()', () => {
    it('retorna a lista de notificações e o unreadCount do usuário', async () => {
      const items = [makeNotification()];
      repository.findAllByUser.mockResolvedValue(items);
      repository.countUnreadByUser.mockResolvedValue(1);

      const result = await service.findAllForUser('user-1', {
        unreadOnly: true,
      });

      expect(repository.findAllByUser).toHaveBeenCalledWith('user-1', {
        unreadOnly: true,
      });
      expect(repository.countUnreadByUser).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ data: items, unreadCount: 1 });
    });
  });

  describe('markAsRead()', () => {
    it('marca e retorna a notificação quando pertence ao usuário', async () => {
      const read = makeNotification({ readAt: new Date() });
      repository.markAsRead.mockResolvedValue(read);

      await expect(service.markAsRead('notif-1', 'user-1')).resolves.toEqual(
        read,
      );
      expect(repository.markAsRead).toHaveBeenCalledWith('notif-1', 'user-1');
    });

    it('lança NotFoundException (404) se a notificação não existir ou pertencer a outro usuário', async () => {
      repository.markAsRead.mockResolvedValue(undefined);

      await expect(
        service.markAsRead('notif-404', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('markAllAsRead()', () => {
    it('marca todas do usuário como lidas e retorna updatedCount', async () => {
      repository.markAllAsRead.mockResolvedValue(3);

      await expect(service.markAllAsRead('user-1')).resolves.toEqual({
        updatedCount: 3,
      });
      expect(repository.markAllAsRead).toHaveBeenCalledWith('user-1');
    });
  });

  describe('notifyPaymentConfirmed()', () => {
    it('cria notificação para o comprador e para os membros aceitos da organização', async () => {
      repository.findEventsByIds.mockResolvedValue([
        { id: 'event-1', name: 'Calourada', organizerId: 'org-1' },
      ]);
      repository.findAcceptedOrganizationMembers.mockResolvedValue(
        new Map([['org-1', ['org-user-1', 'org-user-2']]]),
      );
      repository.createMany.mockResolvedValue([]);

      await service.notifyPaymentConfirmed(
        { id: 'order-1', userId: 'buyer-1' },
        [
          {
            ticketTypeId: 'type-1',
            quantity: 2,
            ticketType: { eventId: 'event-1' },
          },
        ],
      );

      expect(repository.createMany).toHaveBeenCalledWith(
        [
          {
            userId: 'buyer-1',
            type: 'payment_confirmed',
            title: 'Pagamento confirmado',
            message:
              'Seu pagamento foi aprovado e seus ingressos para o evento "Calourada" já estão disponíveis.',
            href: '/conta/ingressos',
          },
          {
            userId: 'org-user-1',
            type: 'new_sale',
            title: 'Nova venda confirmada',
            message:
              'Nova venda de 2 ingresso(s) confirmada para o evento "Calourada".',
            href: '/organizador/eventos/event-1',
          },
          {
            userId: 'org-user-2',
            type: 'new_sale',
            title: 'Nova venda confirmada',
            message:
              'Nova venda de 2 ingresso(s) confirmada para o evento "Calourada".',
            href: '/organizador/eventos/event-1',
          },
        ],
        undefined,
      );
    });
  });

  describe('notifyOrderCancelled()', () => {
    it('cria notificação order_cancelled para o comprador', async () => {
      repository.create.mockResolvedValue(
        makeNotification({ type: 'order_cancelled' }),
      );

      await service.notifyOrderCancelled({ id: 'order-1', userId: 'buyer-1' });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'buyer-1',
          type: 'order_cancelled',
          href: '/conta/pedidos',
        }),
        undefined,
      );
    });
  });

  describe('notifyOrderRefunded()', () => {
    it('cria notificação order_refunded para o comprador', async () => {
      repository.create.mockResolvedValue(
        makeNotification({ type: 'order_refunded' }),
      );

      await service.notifyOrderRefunded({ id: 'order-1', userId: 'buyer-1' });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'buyer-1',
          type: 'order_refunded',
          href: '/conta/pedidos',
        }),
        undefined,
      );
    });
  });

  describe('notifyEventCancelled()', () => {
    it('cria notificação event_cancelled para todos os usuários afetados', async () => {
      repository.findAffectedUsersByEvent.mockResolvedValue([
        'buyer-1',
        'holder-2',
      ]);
      repository.createMany.mockResolvedValue([]);

      await service.notifyEventCancelled({
        id: 'event-1',
        name: 'Festival de Rock',
      });

      expect(repository.findAffectedUsersByEvent).toHaveBeenCalledWith(
        'event-1',
        undefined,
      );
      expect(repository.createMany).toHaveBeenCalledWith(
        [
          {
            userId: 'buyer-1',
            type: 'event_cancelled',
            title: 'Evento cancelado',
            message:
              'O evento "Festival de Rock" foi cancelado pelo organizador.',
            href: '/conta/pedidos',
          },
          {
            userId: 'holder-2',
            type: 'event_cancelled',
            title: 'Evento cancelado',
            message:
              'O evento "Festival de Rock" foi cancelado pelo organizador.',
            href: '/conta/pedidos',
          },
        ],
        undefined,
      );
    });

    it('não grava nada quando não há usuários afetados', async () => {
      repository.findAffectedUsersByEvent.mockResolvedValue([]);

      await service.notifyEventCancelled({
        id: 'event-1',
        name: 'Festival de Rock',
      });

      expect(repository.createMany).not.toHaveBeenCalled();
    });
  });
});

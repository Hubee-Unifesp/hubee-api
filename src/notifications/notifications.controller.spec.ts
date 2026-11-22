import { jest } from '@jest/globals';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import {
  NotificationListResponseDto,
  NotificationResponseDto,
  ReadAllNotificationsResponseDto,
} from './dto/notification-response.dto';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

const USER = {
  id: 'user-1',
  email: 'user@hubee.com',
  role: 'USER' as const,
};

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: {
    findAllForUser: jest.Mock<NotificationsService['findAllForUser']>;
    markAsRead: jest.Mock<NotificationsService['markAsRead']>;
    markAllAsRead: jest.Mock<NotificationsService['markAllAsRead']>;
  };

  beforeEach(async () => {
    service = {
      findAllForUser: jest.fn<NotificationsService['findAllForUser']>(),
      markAsRead: jest.fn<NotificationsService['markAsRead']>(),
      markAllAsRead: jest.fn<NotificationsService['markAllAsRead']>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: service }],
    }).compile();

    controller = module.get(NotificationsController);
  });

  it('findAll() retorna NotificationListResponseDto serializado', async () => {
    const now = new Date('2026-11-22T01:00:00Z');
    service.findAllForUser.mockResolvedValue({
      data: [
        {
          id: 'notif-1',
          userId: USER.id,
          type: 'payment_confirmed',
          title: 'Pagamento confirmado',
          message: 'Ingressos emitidos',
          href: '/conta/ingressos',
          readAt: null,
          createdAt: now,
        },
      ],
      unreadCount: 1,
    });

    const result = await controller.findAll(USER, { unreadOnly: true });

    expect(service.findAllForUser).toHaveBeenCalledWith(USER.id, {
      unreadOnly: true,
    });
    expect(result).toBeInstanceOf(NotificationListResponseDto);
    expect(result.data[0]).toBeInstanceOf(NotificationResponseDto);
    expect(result.unreadCount).toBe(1);
  });

  it('markAsRead() retorna NotificationResponseDto serializado', async () => {
    const now = new Date('2026-11-22T01:05:00Z');
    service.markAsRead.mockResolvedValue({
      id: 'notif-1',
      userId: USER.id,
      type: 'payment_confirmed',
      title: 'Pagamento confirmado',
      message: 'Ingressos emitidos',
      href: '/conta/ingressos',
      readAt: now,
      createdAt: now,
    });

    const result = await controller.markAsRead('notif-1', USER);

    expect(service.markAsRead).toHaveBeenCalledWith('notif-1', USER.id);
    expect(result).toBeInstanceOf(NotificationResponseDto);
    expect(result.readAt).toEqual(now);
  });

  it('markAllAsRead() retorna ReadAllNotificationsResponseDto serializado', async () => {
    service.markAllAsRead.mockResolvedValue({ updatedCount: 4 });

    const result = await controller.markAllAsRead(USER);

    expect(service.markAllAsRead).toHaveBeenCalledWith(USER.id);
    expect(result).toBeInstanceOf(ReadAllNotificationsResponseDto);
    expect(result.updatedCount).toBe(4);
  });
});

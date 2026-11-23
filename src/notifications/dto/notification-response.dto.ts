import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import {
  type NotificationType,
  notificationType,
} from '../../database/schema/notification.schema';

export class NotificationResponseDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id: string;

  @Expose()
  @ApiProperty({ format: 'uuid' })
  userId: string;

  @Expose()
  @ApiProperty({
    enum: notificationType.enumValues,
    example: 'payment_confirmed',
  })
  type: NotificationType;

  @Expose()
  @ApiProperty({ example: 'Pagamento confirmado' })
  title: string;

  @Expose()
  @ApiProperty({
    example:
      'Seus ingressos para o evento "Semana da Computação" foram emitidos.',
  })
  message: string;

  @Expose()
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '/conta/ingressos',
  })
  href: string | null;

  @Expose()
  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
  })
  readAt: Date | null;

  @Expose()
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

export class NotificationListResponseDto {
  @Expose()
  @Type(() => NotificationResponseDto)
  @ApiProperty({ type: NotificationResponseDto, isArray: true })
  data: NotificationResponseDto[];

  @Expose()
  @ApiProperty({
    description: 'Total de notificações não lidas do usuário logado',
    example: 2,
  })
  unreadCount: number;
}

export class ReadAllNotificationsResponseDto {
  @Expose()
  @ApiProperty({
    description: 'Quantidade de notificações marcadas como lidas',
    example: 3,
  })
  updatedCount: number;
}

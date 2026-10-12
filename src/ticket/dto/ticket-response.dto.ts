import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ticketStatus } from '../../database/schema';

/** Contrato de saída (público) de um ingresso. */
export class TicketResponseDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id: string;

  @Expose()
  @ApiProperty()
  qrCode: string;

  @Expose()
  @ApiProperty({ format: 'uuid' })
  orderId: string;

  @Expose()
  @ApiProperty({ format: 'uuid' })
  eventId: string;

  @Expose()
  @ApiProperty({ format: 'uuid' })
  ticketTypeId: string;

  @Expose()
  @ApiProperty({ format: 'uuid', nullable: true, required: false })
  holderUserId: string | null;

  @Expose()
  @ApiProperty({ enum: ticketStatus.enumValues })
  status: string;

  @Expose()
  @ApiProperty()
  createdAt: Date;

  @Expose()
  @ApiProperty()
  updatedAt: Date;
}

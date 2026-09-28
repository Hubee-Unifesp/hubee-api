import { ApiProperty } from '@nestjs/swagger';
import { ticketStatus } from '../../database/schema';

/** Contrato de saída (público) de um ingresso. */
export class TicketResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  qrCode: string;

  @ApiProperty({ format: 'uuid' })
  orderId: string;

  @ApiProperty({ format: 'uuid' })
  eventId: string;

  @ApiProperty({ format: 'uuid' })
  ticketTypeId: string;

  @ApiProperty({ format: 'uuid', nullable: true, required: false })
  holderUserId: string | null;

  @ApiProperty({ enum: ticketStatus.enumValues })
  status: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

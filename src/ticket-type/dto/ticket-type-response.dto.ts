import { ApiProperty } from '@nestjs/swagger';

/** Contrato de saída (público) de um tipo de ingresso. */
export class TicketTypeResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  eventId: string;

  @ApiProperty()
  batch: string;

  @ApiProperty({ type: Number })
  price: number;

  @ApiProperty({ type: Number })
  quantity: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

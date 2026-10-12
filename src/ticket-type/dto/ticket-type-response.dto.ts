import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/** Contrato de saída (público) de um tipo de ingresso. */
export class TicketTypeResponseDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id: string;

  @Expose()
  @ApiProperty({ format: 'uuid' })
  eventId: string;

  @Expose()
  @ApiProperty()
  batch: string;

  @Expose()
  @ApiProperty({ type: Number })
  price: number;

  @Expose()
  @ApiProperty({ type: Number })
  quantity: number;

  @Expose()
  @ApiProperty()
  createdAt: Date;

  @Expose()
  @ApiProperty()
  updatedAt: Date;
}

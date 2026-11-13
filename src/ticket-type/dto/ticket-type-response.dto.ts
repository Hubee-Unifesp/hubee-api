import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ticketTypeModality } from '../../database/schema';

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
  @ApiProperty({
    type: Number,
    description: 'Capacidade total do lote (não é o saldo restante)',
  })
  quantity: number;

  @Expose()
  @ApiProperty({
    type: Number,
    description:
      'Saldo disponível: capacidade menos ingressos vendidos e reservas de pedidos pendentes ainda no prazo',
  })
  available: number;

  @Expose()
  @ApiProperty({ enum: ticketTypeModality.enumValues })
  modality: string;

  @Expose()
  @ApiProperty({
    nullable: true,
    required: false,
    description: 'Início das vendas do lote (null segue o evento)',
  })
  salesStartDate: Date | null;

  @Expose()
  @ApiProperty({
    nullable: true,
    required: false,
    description: 'Fim das vendas do lote (null vende até o fim do evento)',
  })
  salesEndDate: Date | null;

  @Expose()
  @ApiProperty()
  createdAt: Date;

  @Expose()
  @ApiProperty()
  updatedAt: Date;
}

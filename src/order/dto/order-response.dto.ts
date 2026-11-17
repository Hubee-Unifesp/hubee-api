import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { orderStatus, paymentStatusEnum } from '../../database/schema';

/** Resumo do evento embutido na resposta de um pedido. */
export class OrderEventSummaryDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id: string;

  @Expose()
  @ApiProperty()
  name: string;

  @Expose()
  @ApiProperty()
  startDate: Date;

  @Expose()
  @ApiProperty()
  endDate: Date;

  @Expose()
  @ApiProperty({ nullable: true })
  photoUrl: string | null;

  @Expose()
  @ApiProperty()
  status: string;
}

/** Resumo do pagamento embutido na resposta de um pedido. */
export class OrderPaymentSummaryDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id: string;

  @Expose()
  @ApiProperty({ enum: paymentStatusEnum.enumValues })
  status: string;

  @Expose()
  @ApiProperty()
  paymentMethod: string;

  @Expose()
  @ApiProperty({ type: Number })
  amount: number;

  @Expose()
  @ApiProperty({ nullable: true })
  paidAt: Date | null;
}

/** Contrato de saída (público) de um item (lote comprado) do pedido. */
export class OrderItemResponseDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id: string;

  @Expose()
  @ApiProperty({ format: 'uuid' })
  ticketTypeId: string;

  @Expose()
  @ApiProperty()
  quantity: number;

  @Expose()
  @ApiProperty({ type: Number })
  unitPrice: number;

  @Expose()
  @ApiProperty({ nullable: true })
  ticketTypeBatch?: string;

  @Expose()
  @ApiProperty({ nullable: true })
  ticketTypeModality?: string;
}

/** Contrato de saída (público) de um pedido. */
export class OrderResponseDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id: string;

  @Expose()
  @ApiProperty({ format: 'uuid' })
  userId: string;

  @Expose()
  @ApiProperty({ type: Number })
  totalAmount: number;

  @Expose()
  @ApiProperty({ enum: orderStatus.enumValues })
  status: string;

  @Expose()
  @ApiProperty()
  createdAt: Date;

  @Expose()
  @ApiProperty()
  updatedAt: Date;

  @Expose()
  @Type(() => OrderItemResponseDto)
  @ApiProperty({ type: OrderItemResponseDto, isArray: true, required: false })
  items?: OrderItemResponseDto[];

  @Expose()
  @Type(() => OrderEventSummaryDto)
  @ApiProperty({ type: OrderEventSummaryDto, required: false, nullable: true })
  event?: OrderEventSummaryDto | null;

  @Expose()
  @Type(() => OrderPaymentSummaryDto)
  @ApiProperty({
    type: OrderPaymentSummaryDto,
    required: false,
    nullable: true,
  })
  payment?: OrderPaymentSummaryDto | null;
}

import { IsIn, IsNumber, IsOptional, Min } from 'class-validator';
import { orderStatus } from '../../database/schema';
import type { OrderStatus } from '../../database/schema';

/**
 * Não estende `PartialType(CreateOrderDto)` de propósito: trocar o comprador de
 * um pedido já existente não é uma operação válida, então `userId` fica fora.
 */
export class UpdateOrderDto {
  @IsOptional()
  @IsIn(orderStatus.enumValues)
  status?: OrderStatus;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalAmount?: number;
}

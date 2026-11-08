import { IsIn, IsOptional } from 'class-validator';
import { orderStatus } from '../../database/schema';
import type { OrderStatus } from '../../database/schema';

/**
 * Não estende `PartialType(CreateOrderDto)` de propósito: trocar o comprador de
 * um pedido já existente não é uma operação válida, então `userId` fica fora.
 *
 * `totalAmount` também fica fora: o total é calculado no servidor ao criar o
 * pedido e não pode ser editado depois (o `ValidationPipe` com
 * `forbidNonWhitelisted` responde 400 se ele vier no corpo). Quais trocas de
 * `status` são aceitas é regra do `OrderService.update`.
 */
export class UpdateOrderDto {
  @IsOptional()
  @IsIn(orderStatus.enumValues)
  status?: OrderStatus;
}

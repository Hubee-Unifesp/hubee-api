import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';
import { paymentMethodEnum } from '../../database/schema';
import type { PaymentMethod } from '../../database/schema';

/**
 * O valor não vem do cliente: o pagamento é sempre do total do pedido, para
 * que ninguém confirme um pedido pagando menos.
 */
export class CheckoutDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all', { message: 'O pedido deve ser um UUID válido' })
  orderId: string;

  @ApiProperty({ enum: paymentMethodEnum.enumValues })
  @IsIn(paymentMethodEnum.enumValues, {
    message: 'Forma de pagamento inválida',
  })
  paymentMethod: PaymentMethod;
}

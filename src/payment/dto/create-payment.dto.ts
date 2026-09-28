import { Type } from 'class-transformer';
import { IsDate, IsIn, IsNumber, IsOptional, Min } from 'class-validator';
import { paymentMethodEnum, paymentStatusEnum } from '../../database/schema';
import type { PaymentMethod, PaymentStatus } from '../../database/schema';

export class CreatePaymentDto {
  @IsIn(paymentMethodEnum.enumValues)
  paymentMethod: PaymentMethod;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  // Opcional: o pagamento pode ser registrado antes da confirmação do gateway.
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  paidAt?: Date;

  // Opcional: por padrão todo pagamento nasce como 'pendente' (ver schema).
  @IsOptional()
  @IsIn(paymentStatusEnum.enumValues)
  status?: PaymentStatus;
}

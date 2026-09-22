import { IsIn, IsOptional } from 'class-validator';
import { despesaPaymentStatus } from '../../database/schema';
import type { DespesaPaymentStatus } from '../../database/schema';

export class QueryDespesaDto {
  @IsOptional()
  @IsIn(despesaPaymentStatus.enumValues)
  paymentStatus?: DespesaPaymentStatus;
}

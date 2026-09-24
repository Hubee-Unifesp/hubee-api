import { Type } from 'class-transformer';
import { IsDate, IsIn, IsNumber, IsOptional, Min } from 'class-validator';
import { pagamentoMetodo, pagamentoStatus } from '../../database/schema';
import type { PagamentoMetodo, PagamentoStatus } from '../../database/schema';

export class CreatePagamentoDto {
  @IsIn(pagamentoMetodo.enumValues)
  metodoPagamento: PagamentoMetodo;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valorPago: number;

  // Opcional: o pagamento pode ser registrado antes da confirmação do gateway.
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dataPagamento?: Date;

  // Opcional: por padrão todo pagamento nasce como 'pendente' (ver schema).
  @IsOptional()
  @IsIn(pagamentoStatus.enumValues)
  status?: PagamentoStatus;
}

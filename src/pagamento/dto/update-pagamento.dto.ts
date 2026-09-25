import { Type } from 'class-transformer';
import { IsDate, IsIn, IsNumber, IsOptional, Min } from 'class-validator';
import { pagamentoStatus } from '../../database/schema';
import type { PagamentoStatus } from '../../database/schema';

/**
 * PATCH permite atualizar status e valor pago (ex: confirmação assíncrona
 * do gateway). `paymentMethod` não é atualizável: o método com que o
 * pagamento foi iniciado é imutável para fins de auditoria.
 */
export class UpdatePagamentoDto {
  @IsOptional()
  @IsIn(pagamentoStatus.enumValues)
  status?: PagamentoStatus;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  paidAt?: Date;
}
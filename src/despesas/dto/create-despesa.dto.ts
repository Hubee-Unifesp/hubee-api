import { Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { despesaPaymentStatus } from '../../database/schema';
import type { DespesaPaymentStatus } from '../../database/schema';

export class CreateDespesaDto {
  @IsUUID()
  fornecedorId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  description: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  costType: string;

  @Type(() => Date)
  @IsDate()
  dueDate: Date;

  // Opcional: por padrão toda despesa nasce como 'pendente' (ver schema).
  @IsOptional()
  @IsIn(despesaPaymentStatus.enumValues)
  paymentStatus?: DespesaPaymentStatus;
}

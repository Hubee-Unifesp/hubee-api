import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { MAX_EXPECTED_AUDIENCE } from '../../database/schema';

export class QueryPlanningSummaryDto {
  @ApiPropertyOptional({
    description:
      'Público simulado. Sem ele, o cálculo usa o público esperado do evento.',
    minimum: 1,
    maximum: MAX_EXPECTED_AUDIENCE,
    example: 300,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'O público deve ser um número inteiro.' })
  @Min(1, { message: 'O público deve ser de pelo menos 1 pessoa.' })
  @Max(MAX_EXPECTED_AUDIENCE, {
    message: `O público deve ser de no máximo ${MAX_EXPECTED_AUDIENCE} pessoas.`,
  })
  audience?: number;
}

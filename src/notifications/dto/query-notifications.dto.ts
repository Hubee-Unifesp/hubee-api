import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_NOTIFICATIONS_LIMIT = 20;
export const MAX_NOTIFICATIONS_LIMIT = 100;

export class QueryNotificationsDto {
  @ApiPropertyOptional({
    description: 'Retorna apenas notificações ainda não lidas',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'O filtro unreadOnly deve ser um booleano' })
  unreadOnly?: boolean;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_NOTIFICATIONS_LIMIT,
    default: DEFAULT_NOTIFICATIONS_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'O limite deve ser um número inteiro' })
  @Min(1, { message: 'O limite deve ser no mínimo 1' })
  @Max(MAX_NOTIFICATIONS_LIMIT, {
    message: `O limite deve ser no máximo ${MAX_NOTIFICATIONS_LIMIT}`,
  })
  limit?: number = DEFAULT_NOTIFICATIONS_LIMIT;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'O deslocamento deve ser um número inteiro' })
  @Min(0, { message: 'O deslocamento não pode ser negativo' })
  offset?: number = 0;
}

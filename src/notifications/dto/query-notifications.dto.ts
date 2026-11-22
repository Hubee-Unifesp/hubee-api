import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

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
}

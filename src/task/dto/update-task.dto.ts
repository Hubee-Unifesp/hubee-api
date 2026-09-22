import { Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { taskStatus } from '../../database/schema';
import type { TaskStatus } from '../../database/schema';

/**
 * Não estende `PartialType(CreateTaskDto)` de propósito: `@IsOptional` deixa
 * passar `null`, o que nas colunas NOT NULL viraria erro 500 do Postgres. Por
 * isso os campos obrigatórios usam `@ValidateIf` (só pulam quando ausentes), e
 * `null` fica reservado para limpar `description` e `dueDate`.
 */
export class UpdateTaskDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsUUID()
  responsibleUserId?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueDate?: Date | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsIn(taskStatus.enumValues)
  status?: TaskStatus;
}

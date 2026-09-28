import { Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { taskStatus } from '../../database/schema';
import type { TaskStatus } from '../../database/schema';

/** O evento vem da rota (`/eventos/:eventId/tarefas`), não do corpo. */
export class CreateTaskDto {
  @IsUUID()
  responsibleUserId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueDate?: Date;

  @IsOptional()
  @IsIn(taskStatus.enumValues)
  status?: TaskStatus;
}

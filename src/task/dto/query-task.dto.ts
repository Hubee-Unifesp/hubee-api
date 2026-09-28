import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { taskStatus } from '../../database/schema';
import type { TaskStatus } from '../../database/schema';

export class QueryTaskDto {
  @IsOptional()
  @IsIn(taskStatus.enumValues)
  status?: TaskStatus;

  @IsOptional()
  @IsUUID()
  responsibleUserId?: string;
}

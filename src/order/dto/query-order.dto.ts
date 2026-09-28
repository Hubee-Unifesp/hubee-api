import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { orderStatus } from '../../database/schema';
import type { OrderStatus } from '../../database/schema';

export class QueryOrderDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsIn(orderStatus.enumValues)
  status?: OrderStatus;
}

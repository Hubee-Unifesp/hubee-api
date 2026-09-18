import { IsNumber, IsUUID, Min } from 'class-validator';

export class CreateOrderDto {
  @IsUUID()
  userId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalAmount: number;
}

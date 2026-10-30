import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export const MAX_ORDER_ITEMS = 20;
export const MAX_QUANTITY_PER_ITEM = 10;

export class CreateOrderItemDto {
  @ApiProperty({ format: 'uuid', description: 'Lote (ticket type) comprado.' })
  @IsUUID('all', { message: 'O lote deve ser um UUID válido' })
  ticketTypeId: string;

  @ApiProperty({ minimum: 1, maximum: MAX_QUANTITY_PER_ITEM })
  @IsInt({ message: 'A quantidade deve ser um número inteiro' })
  @Min(1, { message: 'A quantidade mínima por lote é 1' })
  @Max(MAX_QUANTITY_PER_ITEM, {
    message: `A quantidade máxima por lote é ${MAX_QUANTITY_PER_ITEM}`,
  })
  quantity: number;
}

/**
 * O total não vem do cliente: o service o calcula com o preço atual de cada
 * lote, para que ninguém compre ingresso por um valor que escolheu.
 */
export class CreateOrderDto {
  @ApiProperty({ type: CreateOrderItemDto, isArray: true })
  @IsArray({ message: 'Os itens do pedido devem ser uma lista' })
  @ArrayMinSize(1, { message: 'O pedido precisa ter ao menos um item' })
  @ArrayMaxSize(MAX_ORDER_ITEMS, {
    message: `O pedido pode ter no máximo ${MAX_ORDER_ITEMS} itens`,
  })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}

import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class PaginationMetaDto {
  @Expose()
  @ApiProperty({ example: 1 })
  page: number;

  @Expose()
  @ApiProperty({ example: 20 })
  limit: number;

  @Expose()
  @ApiProperty({ description: 'Total de itens que atendem aos filtros' })
  total: number;

  @Expose()
  @ApiProperty({ description: 'Total de páginas (0 quando não há itens)' })
  totalPages: number;
}

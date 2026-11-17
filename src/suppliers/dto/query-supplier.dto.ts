import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const SUPPLIER_SORT_BY = ['rating', 'companyName', 'createdAt'] as const;
export type SupplierSortBy = (typeof SUPPLIER_SORT_BY)[number];

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const toNumber = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() !== '' ? Number(value) : value;

export class QuerySupplierDto {
  @ApiPropertyOptional({
    description:
      'Busca textual pelo nome da empresa / fornecedor (companyName)',
  })
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'A busca deve ser um texto' })
  @IsNotEmpty({ message: 'A busca não pode ser vazia' })
  @MaxLength(255, { message: 'A busca deve ter no máximo 255 caracteres' })
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtro pela categoria do fornecedor',
    example: 'Buffet',
  })
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'A categoria deve ser um texto' })
  @IsNotEmpty({ message: 'A categoria não pode ser vazia' })
  @MaxLength(100, { message: 'A categoria deve ter no máximo 100 caracteres' })
  category?: string;

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: 5,
    description:
      'Filtra fornecedores com média de avaliação maior ou igual a este valor (1 a 5)',
    example: 4,
  })
  @IsOptional()
  @Transform(toNumber)
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'A nota mínima deve ser um número entre 1 e 5' },
  )
  @Min(1, { message: 'A nota mínima deve ser no mínimo 1' })
  @Max(5, { message: 'A nota mínima deve ser no máximo 5' })
  minRating?: number;

  @ApiPropertyOptional({
    enum: SUPPLIER_SORT_BY,
    description: 'Campo de ordenação dos fornecedores',
    example: 'rating',
  })
  @IsOptional()
  @Transform(trim)
  @IsIn(SUPPLIER_SORT_BY, {
    message: `A ordenação deve ser uma das seguintes: ${SUPPLIER_SORT_BY.join(', ')}`,
  })
  sortBy?: SupplierSortBy;
}

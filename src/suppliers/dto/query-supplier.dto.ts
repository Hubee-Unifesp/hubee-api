import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

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
}

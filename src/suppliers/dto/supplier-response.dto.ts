import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/** Contrato de saída (público) de um fornecedor. Omite `deletedAt`. */
export class SupplierResponseDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id: string;

  @Expose()
  @ApiProperty()
  companyName: string;

  @Expose()
  @ApiProperty({ description: 'CNPJ ou CPF do fornecedor' })
  cnpjCpf: string;

  @Expose()
  @ApiProperty({ nullable: true, required: false })
  phone: string | null;

  @Expose()
  @ApiProperty({ nullable: true, required: false })
  email: string | null;

  @Expose()
  @ApiProperty({ nullable: true, required: false })
  category: string | null;

  @Expose()
  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Média das avaliações (1 a 5, arredondada para 1 casa decimal) ou null quando não há avaliações',
    example: 4.5,
  })
  ratingAverage: number | null;

  @Expose()
  @ApiProperty({
    type: Number,
    description: 'Quantidade total de avaliações recebidas',
    example: 12,
  })
  ratingCount: number;

  @Expose()
  @ApiProperty()
  createdAt: Date;

  @Expose()
  @ApiProperty()
  updatedAt: Date;
}

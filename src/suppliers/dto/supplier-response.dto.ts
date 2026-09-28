import { ApiProperty } from '@nestjs/swagger';

/**
 * Contrato de saída (público) de um fornecedor.
 *
 * Documentação-only por enquanto: os endpoints ainda retornam a linha do banco.
 * A aplicação em runtime (retornar instâncias deste DTO, omitindo campos
 * internos como `deletedAt`) é uma task futura. Ver docs/CONVENTIONS.md.
 */
export class SupplierResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  companyName: string;

  @ApiProperty({ description: 'CNPJ ou CPF do fornecedor' })
  cnpjCpf: string;

  @ApiProperty({ nullable: true, required: false })
  phone: string | null;

  @ApiProperty({ nullable: true, required: false })
  email: string | null;

  @ApiProperty({ nullable: true, required: false })
  category: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

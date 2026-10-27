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
  @ApiProperty()
  createdAt: Date;

  @Expose()
  @ApiProperty()
  updatedAt: Date;
}

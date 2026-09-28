import { ApiProperty } from '@nestjs/swagger';

/**
 * Contrato de saída (público) de um usuário. Omite `password` e `deletedAt`.
 * Documentação-only por enquanto (ver docs/CONVENTIONS.md).
 */
export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ nullable: true, required: false })
  phone: string | null;

  @ApiProperty({ description: 'CPF do usuário' })
  cpf: string;

  @ApiProperty({ format: 'date' })
  birthDate: string;

  @ApiProperty()
  profileType: string;

  @ApiProperty({ example: 'ACTIVE', nullable: true, required: false })
  status: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

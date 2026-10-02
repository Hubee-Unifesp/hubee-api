import { ApiProperty } from '@nestjs/swagger';

/**
 * Contrato de saída (público) de um usuário. Omite `password` e `deletedAt`.
 * Documentação-only por enquanto (ver docs/CONVENTIONS.md).
 */
export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ nullable: true, required: false })
  phone: string | null;

  @ApiProperty({ description: 'CPF do usuário', nullable: true })
  cpf: string | null;

  @ApiProperty({ format: 'date', nullable: true })
  birthDate: string | null;

  @ApiProperty()
  role: 'USER' | 'ADMIN';

  @ApiProperty({ enum: ['BUY', 'ORGANIZE'], nullable: true })
  signupIntent: 'BUY' | 'ORGANIZE' | null;

  @ApiProperty({ example: 'ACTIVE', nullable: true, required: false })
  status: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

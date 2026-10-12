import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/** Contrato de saída (público) de um usuário. Omite `password` e `deletedAt`. */
export class UserResponseDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id: string;

  @Expose()
  @ApiProperty()
  fullName: string;

  @Expose()
  @ApiProperty()
  email: string;

  @Expose()
  @ApiProperty({ nullable: true, required: false })
  phone: string | null;

  @Expose()
  @ApiProperty({ description: 'CPF do usuário', nullable: true })
  cpf: string | null;

  @Expose()
  @ApiProperty({ format: 'date', nullable: true })
  birthDate: string | null;

  @Expose()
  @ApiProperty()
  role: 'USER' | 'ADMIN';

  @Expose()
  @ApiProperty({ enum: ['BUY', 'ORGANIZE'], nullable: true })
  signupIntent: 'BUY' | 'ORGANIZE' | null;

  @Expose()
  @ApiProperty({ example: 'ACTIVE', nullable: true, required: false })
  status: string | null;

  @Expose()
  @ApiProperty()
  createdAt: Date;

  @Expose()
  @ApiProperty()
  updatedAt: Date;
}

export class MeResponseDto extends UserResponseDto {
  @Expose()
  @ApiProperty()
  profileComplete: boolean;
}

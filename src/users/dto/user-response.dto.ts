import { Expose, Type } from 'class-transformer';
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

/** Organização em que o usuário logado é membro (convite aceito). */
export class MeOrganizationDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  orgId: string;

  @Expose()
  @ApiProperty({ example: 'Atlética Unifesp' })
  organizationName: string;

  @Expose()
  @ApiProperty({ example: 'member', description: 'Papel na organização' })
  role: string;

  @Expose()
  @ApiProperty({ example: 'full', description: 'Permissão na organização' })
  permission: string;

  @Expose()
  @ApiProperty({
    enum: ['read', 'write', 'manage'],
    description:
      'Nível efetivo: `read` só consulta, `write` cria e altera eventos, `manage` também administra a organização',
  })
  level: 'read' | 'write' | 'manage';
}

export class MeResponseDto extends UserResponseDto {
  @Expose()
  @ApiProperty()
  profileComplete: boolean;

  @Expose()
  @Type(() => MeOrganizationDto)
  @ApiProperty({ type: MeOrganizationDto, isArray: true })
  organizations: MeOrganizationDto[];
}

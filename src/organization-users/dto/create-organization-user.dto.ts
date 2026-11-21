import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';
import { NormalizeEmail } from '../../common/validation/normalize-email';

/**
 * Nomenclatura oficial da API: inglês, alinhado com as colunas do schema
 * (role, permission, invite_status).
 *
 * Ajuste os valores destes enums para o domínio real do projeto — eles
 * precisam caber em varchar(20) e devem ser a única fonte da verdade,
 * usada também nos testes.
 */
export enum OrganizationRole {
  ADMIN = 'admin',
  MEMBER = 'member',
}

export enum OrganizationPermission {
  FULL = 'full',
  READ_ONLY = 'read_only',
}

export enum InviteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

export class CreateOrganizationUserDto {
  @ApiProperty({
    format: 'email',
    example: 'membro@exemplo.com',
    description: 'E-mail do usuário ativo a ser convidado para a organização',
  })
  @NormalizeEmail()
  @IsNotEmpty({ message: 'O e-mail é obrigatório.' })
  @IsEmail({}, { message: 'E-mail inválido.' })
  email: string;

  @ApiProperty({ enum: OrganizationRole, example: OrganizationRole.MEMBER })
  @IsEnum(OrganizationRole)
  role: OrganizationRole;

  @ApiProperty({
    enum: OrganizationPermission,
    example: OrganizationPermission.FULL,
  })
  @IsEnum(OrganizationPermission)
  permission: OrganizationPermission;
}

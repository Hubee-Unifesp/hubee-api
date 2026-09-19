import { IsEnum, IsOptional, IsUUID } from 'class-validator';

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

export class CreateOrganizacaoUsuarioDto {
  @IsUUID()
  userId: string;

  @IsEnum(OrganizationRole)
  role: OrganizationRole;

  @IsEnum(OrganizationPermission)
  permission: OrganizationPermission;

  /**
   * Opcional: o schema já aplica o default 'pending'.
   * Só informe se o vínculo for criado já aceito (ex.: dono da organização).
   */
  @IsOptional()
  @IsEnum(InviteStatus)
  inviteStatus?: InviteStatus;
}
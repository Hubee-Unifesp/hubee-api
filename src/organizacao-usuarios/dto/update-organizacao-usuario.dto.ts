import { IsEnum, IsOptional } from 'class-validator';
import {
  InviteStatus,
  OrganizationPermission,
  OrganizationRole,
} from './create-organizacao-usuario.dto';

/**
 * Não é PartialType(CreateOrganizacaoUsuarioDto) de propósito: userId e orgId
 * fazem parte da chave primária composta e vêm pela rota, não pelo body.
 */
export class UpdateOrganizacaoUsuarioDto {
  @IsOptional()
  @IsEnum(OrganizationRole)
  role?: OrganizationRole;

  @IsOptional()
  @IsEnum(OrganizationPermission)
  permission?: OrganizationPermission;

  @IsOptional()
  @IsEnum(InviteStatus)
  inviteStatus?: InviteStatus;
}
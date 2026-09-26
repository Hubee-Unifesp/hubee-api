import { IsEnum } from 'class-validator';
import {
  InviteStatus,
  OrganizationPermission,
  OrganizationRole,
} from './create-organizacao-usuario.dto';
import { IsOptionalUpdate } from '../../common/validation/update-validation';

/**
 * Não é PartialType(CreateOrganizacaoUsuarioDto) de propósito: userId e orgId
 * fazem parte da chave primária composta e vêm pela rota, não pelo body.
 */
export class UpdateOrganizacaoUsuarioDto {
  @IsOptionalUpdate()
  @IsEnum(OrganizationRole)
  role?: OrganizationRole;

  @IsOptionalUpdate()
  @IsEnum(OrganizationPermission)
  permission?: OrganizationPermission;

  @IsOptionalUpdate()
  @IsEnum(InviteStatus)
  inviteStatus?: InviteStatus;
}

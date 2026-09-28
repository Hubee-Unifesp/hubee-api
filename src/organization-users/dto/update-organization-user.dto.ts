import { IsEnum } from 'class-validator';
import {
  InviteStatus,
  OrganizationPermission,
  OrganizationRole,
} from './create-organization-user.dto';
import { IsOptionalUpdate } from '../../common/validation/update-validation';

/**
 * Não é PartialType(CreateOrganizationUserDto) de propósito: userId e orgId
 * fazem parte da chave primária composta e vêm pela rota, não pelo body.
 */
export class UpdateOrganizationUserDto {
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

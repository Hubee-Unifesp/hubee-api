import { IsEnum } from 'class-validator';
import {
  OrganizationRole,
  OrganizationPermission,
} from './create-organizacao-usuario.dto';
import { IsOptionalUpdate } from '../../common/validation/update-validation';

export enum InviteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
}

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

import { IsEnum, IsOptional } from 'class-validator';
import {
  OrganizationRole,
  OrganizationPermission,
} from './create-organizacao-usuario.dto';

export enum InviteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
}

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
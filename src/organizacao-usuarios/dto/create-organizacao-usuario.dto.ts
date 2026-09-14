import { IsUUID, IsEnum } from 'class-validator';

export enum OrganizationRole {
  ADMIN = 'admin',
  MEMBER = 'member',
}

export enum OrganizationPermission {
  FULL = 'full',
  EDIT = 'edit',
  READ = 'read',
}

export class CreateOrganizacaoUsuarioDto {
  @IsUUID()
  userId: string;

  @IsEnum(OrganizationRole)
  role: OrganizationRole;

  @IsEnum(OrganizationPermission)
  permission: OrganizationPermission;
}